import uuid
import os
import httpx
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response
from pydantic import BaseModel, Field
from sqlalchemy import select, text, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.database.db import get_master_db, MasterSessionLocal, Base, get_tenant_connection_string, evict_tenant_cache
from app.database.master_models import Tenant, SuperAdmin
from app.core.config import settings
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token
)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# ─── Cloudflare DNS Auto-Provisioning ────────────────────────────────────────
CF_API_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "")
CF_ZONE_ID   = os.environ.get("CLOUDFLARE_ZONE_ID", "")
CF_DOMAIN    = os.environ.get("CF_ROOT_DOMAIN", "crediiflow.in")
VPS_IP       = os.environ.get("VPS_IP", "187.127.176.149")

def _cf_headers():
    return {"Authorization": f"Bearer {CF_API_TOKEN}", "Content-Type": "application/json"}

def cloudflare_add_dns(subdomain: str) -> None:
    """Create a proxied A record for <subdomain>.<CF_DOMAIN> on Cloudflare.
    Silently skips if env vars are not configured."""
    if not CF_API_TOKEN or not CF_ZONE_ID:
        print(f"[CF DNS] Skipped — CLOUDFLARE_API_TOKEN/CLOUDFLARE_ZONE_ID not set")
        return
    fqdn = f"{subdomain}.{CF_DOMAIN}"
    try:
        with httpx.Client(timeout=10) as client:
            r = client.post(
                f"https://api.cloudflare.com/client/v4/zones/{CF_ZONE_ID}/dns_records",
                headers=_cf_headers(),
                json={"type": "A", "name": fqdn, "content": VPS_IP, "ttl": 1, "proxied": True}
            )
            data = r.json()
            if r.status_code == 200 and data.get("success"):
                print(f"[CF DNS] Created A record: {fqdn} → {VPS_IP}")
            else:
                # Record may already exist — log but don't crash
                print(f"[CF DNS] Could not create {fqdn}: {data.get('errors')}")
    except Exception as e:
        print(f"[CF DNS] Exception adding {fqdn}: {e}")

def trigger_ssl_provisioning() -> None:
    """Drop the same trigger file the manual "Renew SSL" button writes -- the
    host-level automation (outside this repo) watches for it, runs Certbot
    against every tenant subdomain currently in the master DB, and reloads
    Nginx. Called automatically after a new tenant is created so a fresh
    subdomain gets a working cert without a manual renew click, matching the
    behavior new tenants had before this call went missing from create_tenant.
    Raises on failure -- callers that must not fail the whole request over
    this (e.g. tenant creation, mirroring how the Cloudflare DNS call is
    treated) are responsible for catching it themselves."""
    trigger_dir = "/app/triggers"
    os.makedirs(trigger_dir, exist_ok=True)
    with open(os.path.join(trigger_dir, "ssl_renew.trigger"), "w") as f:
        f.write(datetime.utcnow().isoformat())

def cloudflare_delete_dns(subdomain: str) -> None:
    """Delete all A records for <subdomain>.<CF_DOMAIN> from Cloudflare.
    Silently skips if env vars are not configured."""
    if not CF_API_TOKEN or not CF_ZONE_ID:
        return
    fqdn = f"{subdomain}.{CF_DOMAIN}"
    try:
        with httpx.Client(timeout=10) as client:
            # List existing records matching this name
            r = client.get(
                f"https://api.cloudflare.com/client/v4/zones/{CF_ZONE_ID}/dns_records",
                headers=_cf_headers(),
                params={"type": "A", "name": fqdn}
            )
            records = r.json().get("result", [])
            for rec in records:
                del_r = client.delete(
                    f"https://api.cloudflare.com/client/v4/zones/{CF_ZONE_ID}/dns_records/{rec['id']}",
                    headers=_cf_headers()
                )
                if del_r.status_code == 200:
                    print(f"[CF DNS] Deleted A record: {fqdn}")
    except Exception as e:
        print(f"[CF DNS] Exception deleting {fqdn}: {e}")
# ─────────────────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/superadmin", tags=["Super Admin"])
security = HTTPBearer(auto_error=False)

# Schemas
class SuperAdminLoginRequest(BaseModel):
    username: str
    password: str

class SuperAdminTokenResponse(BaseModel):
    access_token: str
    token_type: str
    name: str
    username: str

class TenantCreateRequest(BaseModel):
    name: str = Field(..., max_length=100)
    subdomain: str = Field(..., max_length=50, pattern=r"^[a-z0-9-]+$")
    admin_name: str = Field(..., max_length=100)
    admin_phone: str = Field(..., max_length=20)
    admin_password: str = Field(..., min_length=6)

class TenantMaintenanceRequest(BaseModel):
    maintenance_mode: bool

class TenantUpdateRequest(BaseModel):
    name: str = Field(..., max_length=100)
    status: str = Field(..., max_length=20)
    subdomain: Optional[str] = Field(None, max_length=50, pattern=r"^[a-z0-9-]+$")
    admin_phone: Optional[str] = Field(None, max_length=20)
    admin_password: Optional[str] = Field(None, min_length=6)

class TenantResponse(BaseModel):
    id: uuid.UUID
    name: str
    subdomain: str
    db_name: str
    status: str
    maintenance_mode: bool
    created_at: datetime
    admin_phone: Optional[str] = None

    class Config:
        from_attributes = True

# Dependency to verify Super Admin
def get_current_super_admin(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> SuperAdmin:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate Super Admin credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not credentials:
        raise credentials_exception
    token = credentials.credentials
    payload = decode_token(token, expected_type="access")
    if payload is None:
        raise credentials_exception
    admin_id_str = payload.get("sub")
    if not admin_id_str:
        raise credentials_exception
        
    master_db = MasterSessionLocal()
    try:
        admin = master_db.query(SuperAdmin).filter(SuperAdmin.id == uuid.UUID(admin_id_str)).first()
        if not admin or not admin.is_active:
            raise credentials_exception
        master_db.expunge(admin)
        return admin
    finally:
        master_db.close()

# Routes
@router.post("/login", response_model=SuperAdminTokenResponse)
def login(login_data: SuperAdminLoginRequest, db: Session = Depends(get_master_db)):
    admin = db.scalar(select(SuperAdmin).where(SuperAdmin.username == login_data.username))
    if not admin or not verify_password(login_data.password, admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    access_token = create_access_token(data={"sub": str(admin.id)})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "name": admin.name,
        "username": admin.username
    }

@router.post("/tenants", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
def create_tenant(
    tenant_data: TenantCreateRequest,
    db: Session = Depends(get_master_db),
    current_admin: SuperAdmin = Depends(get_current_super_admin)
):
    # Check if subdomain already exists
    existing = db.scalar(select(Tenant).where(Tenant.subdomain == tenant_data.subdomain))
    if existing:
        raise HTTPException(status_code=400, detail="Subdomain already registered")
        
    db_name = f"crediiflow_{tenant_data.subdomain.replace('-', '_')}"
    
    # Create database and run migrations/seed
    try:
        # Create physical database and schema
        pg_url = f"postgresql://{settings.DB_USER}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/postgres"
        pg_engine = create_engine(pg_url, isolation_level="AUTOCOMMIT")
        with pg_engine.connect() as conn:
            result = conn.execute(text(f"SELECT 1 FROM pg_database WHERE datname='{db_name}'"))
            if not result.fetchone():
                conn.execute(text(f"CREATE DATABASE {db_name}"))
        
        # Populate tables
        tenant_url = get_tenant_connection_string(db_name)
        tenant_engine = create_engine(tenant_url)
        
        # Import models inside to avoid circular reference issues and bind Base
        from app.database import models
        Base.metadata.create_all(bind=tenant_engine)
        
        # Seed Tenant Admin & Default Settings
        TenantSession = sessionmaker(bind=tenant_engine)
        tenant_db = TenantSession()
        try:
            # Seed Admin
            new_admin = models.User(
                name=tenant_data.admin_name,
                phone=tenant_data.admin_phone,
                password_hash=get_password_hash(tenant_data.admin_password),
                role="admin"
            )
            tenant_db.add(new_admin)
            
            # Seed CMS Retailer
            cms_retailer = models.Retailer(
                retailer_name="CMS",
                phone="0000000000",
                address="CMS Managed Stores",
                opening_to_give=0.00,
                opening_to_take=0.00,
                balance=0.00
            )
            tenant_db.add(cms_retailer)
            
            # Seed default BusinessSettings
            settings_obj = models.BusinessSettings(
                late_threshold="10:00",
                late_penalty=100.0,
                auto_checkout_time="20:00"
            )
            tenant_db.add(settings_obj)
            tenant_db.commit()
        finally:
            tenant_db.close()
            
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create tenant database or schemas: {str(e)}"
        )

    # Save to central master database
    new_tenant = Tenant(
        name=tenant_data.name,
        subdomain=tenant_data.subdomain,
        db_name=db_name,
        status="active"
    )
    db.add(new_tenant)
    db.commit()
    db.refresh(new_tenant)

    # Auto-provision Cloudflare DNS A record for the new subdomain
    cloudflare_add_dns(tenant_data.subdomain)

    # Auto-provision the SSL cert for the new subdomain (fire-and-forget, same
    # as the manual "Renew SSL" button -- see trigger_ssl_provisioning above).
    # Non-fatal: a trigger-write failure shouldn't roll back an otherwise
    # successful tenant creation, same treatment as the Cloudflare DNS call.
    try:
        trigger_ssl_provisioning()
    except Exception as e:
        print(f"[SSL] Failed to write provisioning trigger for new tenant: {e}")

    res = TenantResponse.model_validate(new_tenant)
    res.admin_phone = tenant_data.admin_phone
    return res

@router.get("/tenants/{tenant_id}/stats")
def get_tenant_stats(
    tenant_id: uuid.UUID,
    db: Session = Depends(get_master_db),
    current_admin: SuperAdmin = Depends(get_current_super_admin)
):
    tenant = db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenant_url = get_tenant_connection_string(tenant.db_name)
    tenant_engine = create_engine(tenant_url)
    try:
        with tenant_engine.connect() as conn:
            db_size_bytes = conn.execute(
                text("SELECT pg_database_size(:name)"), {"name": tenant.db_name}
            ).scalar()
            staff_count = conn.execute(
                text("SELECT COUNT(*) FROM users WHERE role = 'staff'")
            ).scalar()
            admin_count = conn.execute(
                text("SELECT COUNT(*) FROM users WHERE role = 'admin'")
            ).scalar()
            retailer_count = conn.execute(text("SELECT COUNT(*) FROM retailers")).scalar()
            collection_count = conn.execute(text("SELECT COUNT(*) FROM collections")).scalar()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read tenant stats: {str(e)}")

    return {
        "db_size_mb": round((db_size_bytes or 0) / (1024 * 1024), 2),
        "staff_count": staff_count or 0,
        "admin_count": admin_count or 0,
        "retailer_count": retailer_count or 0,
        "collection_count": collection_count or 0,
    }


@router.get("/tenants", response_model=List[TenantResponse])
def list_tenants(
    db: Session = Depends(get_master_db),
    current_admin: SuperAdmin = Depends(get_current_super_admin)
):
    tenants = db.scalars(select(Tenant)).all()
    response_list = []
    for t in tenants:
        admin_phone = None
        try:
            tenant_url = get_tenant_connection_string(t.db_name)
            tenant_engine = create_engine(tenant_url)
            TenantSession = sessionmaker(bind=tenant_engine)
            tenant_db = TenantSession()
            try:
                from app.database import models
                admin_user = tenant_db.query(models.User).filter(models.User.role == "admin").first()
                if admin_user:
                    admin_phone = admin_user.phone
            finally:
                tenant_db.close()
        except Exception as e:
            print(f"Failed to fetch admin phone for {t.db_name}: {str(e)}")
            
        res_t = TenantResponse.model_validate(t)
        res_t.admin_phone = admin_phone
        response_list.append(res_t)
    return response_list

@router.post("/tenants/{tenant_id}/maintenance", response_model=TenantResponse)
def toggle_tenant_maintenance(
    tenant_id: uuid.UUID,
    payload: TenantMaintenanceRequest,
    db: Session = Depends(get_master_db),
    current_admin: SuperAdmin = Depends(get_current_super_admin)
):
    tenant = db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    tenant.maintenance_mode = payload.maintenance_mode
    db.commit()
    db.refresh(tenant)
    return tenant

@router.put("/tenants/{tenant_id}", response_model=TenantResponse)
def update_tenant(
    tenant_id: uuid.UUID,
    payload: TenantUpdateRequest,
    db: Session = Depends(get_master_db),
    current_admin: SuperAdmin = Depends(get_current_super_admin)
):
    tenant = db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
        
    tenant.name = payload.name
    tenant.status = payload.status
    
    # Update subdomain if provided and changed
    if payload.subdomain:
        new_subdomain = payload.subdomain.lower().replace(" ", "-")
        if new_subdomain != tenant.subdomain:
            existing = db.scalar(select(Tenant).where(Tenant.subdomain == new_subdomain))
            if existing:
                raise HTTPException(status_code=400, detail="Subdomain already registered")
            old_subdomain = tenant.subdomain
            tenant.subdomain = new_subdomain
            # Swap Cloudflare DNS: remove old record, create new one
            cloudflare_delete_dns(old_subdomain)
            cloudflare_add_dns(new_subdomain)

    admin_phone = None
    # Update admin credentials in the isolated tenant database if provided
    try:
        tenant_url = get_tenant_connection_string(tenant.db_name)
        tenant_engine = create_engine(tenant_url)
        TenantSession = sessionmaker(bind=tenant_engine)
        tenant_db = TenantSession()
        try:
            from app.database import models
            admin_user = tenant_db.query(models.User).filter(models.User.role == "admin").first()
            if admin_user:
                if payload.admin_phone:
                    dup = tenant_db.query(models.User).filter(
                        models.User.phone == payload.admin_phone,
                        models.User.id != admin_user.id
                    ).first()
                    if dup:
                        raise HTTPException(status_code=400, detail="Phone number already in use by another user in this tenant")
                    admin_user.phone = payload.admin_phone
                if payload.admin_password:
                    admin_user.password_hash = get_password_hash(payload.admin_password)
                tenant_db.commit()
                admin_phone = admin_user.phone
        finally:
            tenant_db.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update tenant admin credentials: {str(e)}"
        )

    db.commit()
    db.refresh(tenant)
    
    res = TenantResponse.model_validate(tenant)
    res.admin_phone = admin_phone
    return res

@router.delete("/tenants/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tenant(
    tenant_id: uuid.UUID,
    db: Session = Depends(get_master_db),
    current_admin: SuperAdmin = Depends(get_current_super_admin)
):
    tenant = db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Try to drop the tenant's database to clean up resources
    try:
        pg_url = f"postgresql://{settings.DB_USER}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/postgres"
        pg_engine = create_engine(pg_url, isolation_level="AUTOCOMMIT")
        with pg_engine.connect() as conn:
            # Terminate active connections to the database to prevent drop database locks
            conn.execute(text(
                f"SELECT pg_terminate_backend(pg_stat_activity.pid) "
                f"FROM pg_stat_activity "
                f"WHERE pg_stat_activity.datname = '{tenant.db_name}' "
                f"AND pid <> pg_backend_pid()"
            ))
            conn.execute(text(f"DROP DATABASE IF EXISTS {tenant.db_name}"))
    except Exception as e:
        # Log error but don't crash if DB was already dropped or has issues
        print(f"Failed to drop database {tenant.db_name}: {str(e)}")

    # Evict stale cached SQLAlchemy engine so next API call from this tenant gets 404 immediately
    evict_tenant_cache(tenant.db_name)

    # Remove Cloudflare DNS A record for the deleted subdomain
    cloudflare_delete_dns(tenant.subdomain)

    db.delete(tenant)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/infra/status")
def get_infra_status(
    db: Session = Depends(get_master_db),
    current_admin: SuperAdmin = Depends(get_current_super_admin)
):
    try:
        active_connections = db.execute(
            text("SELECT COUNT(*) FROM pg_stat_activity WHERE datname IS NOT NULL")
        ).scalar()
        pg_version_raw = db.execute(text("SHOW server_version")).scalar()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read database status: {str(e)}")

    return {
        "active_connections": active_connections or 0,
        "pg_version": pg_version_raw or "unknown",
    }


@router.get("/infra/services")
def get_infra_services(
    db: Session = Depends(get_master_db),
    current_admin: SuperAdmin = Depends(get_current_super_admin)
):
    """Real reachability check for each docker-compose service, probed live over the
    internal Docker network from inside this backend container -- replaces the old
    hardcoded "Active Container Host Services" table (5 rows, 100% fake, would show
    "Running" even during an actual crash).

    Deliberately does NOT use the Docker socket/API: that would need this container
    to either run as root or have its non-root user's GID matched to the host's
    docker group, both of which weaken the "Run application under non-privileged
    system user" hardening this Dockerfile already does on purpose. An HTTP/TCP
    reachability probe over the compose network answers the same real question --
    "is this service actually up" -- without that privilege escalation.
    """
    import socket as socket_lib
    import time as time_lib

    services = [{
        "name": "Backend API", "container": "crediiflow_backend",
        "check": "self", "status": "up", "detail": "Responding to this request", "latency_ms": 0,
    }]

    http_targets = [
        ("Tenant Frontend", "crediiflow_frontend", "http://frontend:3000/"),
        ("Superadmin Frontend", "crediiflow_superadmin_frontend", "http://superadmin-frontend:3001/"),
        ("Landing Page", "crediiflow_landing_page", "http://landing-page:3002/"),
    ]
    for name, container, url in http_targets:
        start = time_lib.monotonic()
        try:
            with httpx.Client(timeout=3.0) as client:
                resp = client.get(url)
            services.append({
                "name": name, "container": container, "check": url,
                "status": "up" if resp.status_code < 500 else "degraded",
                "detail": f"HTTP {resp.status_code}",
                "latency_ms": round((time_lib.monotonic() - start) * 1000),
            })
        except Exception as e:
            services.append({
                "name": name, "container": container, "check": url,
                "status": "unreachable", "detail": str(e)[:120], "latency_ms": None,
            })

    # Nginx routes by Host header/server_name, so an unmatched GET would just 404
    # from nginx itself -- a bare TCP connect is the honest check for "is the
    # process listening at all" here.
    start = time_lib.monotonic()
    try:
        with socket_lib.create_connection(("nginx", 80), timeout=3.0):
            pass
        services.append({
            "name": "Nginx Reverse Proxy", "container": "crediiflow_nginx",
            "check": "tcp:nginx:80", "status": "up", "detail": "Port open",
            "latency_ms": round((time_lib.monotonic() - start) * 1000),
        })
    except Exception as e:
        services.append({
            "name": "Nginx Reverse Proxy", "container": "crediiflow_nginx",
            "check": "tcp:nginx:80", "status": "unreachable", "detail": str(e)[:120], "latency_ms": None,
        })

    start = time_lib.monotonic()
    try:
        db.execute(text("SELECT 1"))
        services.append({
            "name": "PostgreSQL Database", "container": "crediiflow_db",
            "check": "SELECT 1", "status": "up", "detail": "Query succeeded",
            "latency_ms": round((time_lib.monotonic() - start) * 1000),
        })
    except Exception as e:
        services.append({
            "name": "PostgreSQL Database", "container": "crediiflow_db",
            "check": "SELECT 1", "status": "unreachable", "detail": str(e)[:120], "latency_ms": None,
        })

    return {"services": services, "checked_at": datetime.utcnow().isoformat()}


@router.get("/ssl/status")
def get_ssl_status(
    current_admin: SuperAdmin = Depends(get_current_super_admin)
):
    import socket
    import ssl
    
    hostname = "api.crediiflow.in"
    context = ssl.create_default_context()
    try:
        with socket.create_connection((hostname, 443), timeout=5) as sock:
            with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                cert = ssock.getpeercert()
                
                ssl_date_fmt = r'%b %d %H:%M:%S %Y %Z'
                expire_str = cert.get('notAfter')
                expire_date = datetime.strptime(expire_str, ssl_date_fmt)
                
                subject = dict(x[0] for x in cert.get('subject', []))
                issuer = dict(x[0] for x in cert.get('issuer', []))
                
                days_left = (expire_date - datetime.utcnow()).days
                
                return {
                    "domain": subject.get('commonName', hostname),
                    "issuer": issuer.get('commonName', 'Unknown'),
                    "expiry_date": expire_date.strftime("%Y-%m-%d %H:%M:%S UTC"),
                    "days_remaining": days_left,
                    "status": "secure" if days_left > 15 else "warning" if days_left > 0 else "expired"
                }
    except Exception as e:
        return {
            "domain": hostname,
            "issuer": "N/A",
            "expiry_date": "N/A",
            "days_remaining": 0,
            "status": "error",
            "error": str(e)
        }


@router.post("/ssl/renew")
def trigger_ssl_renewal(
    current_admin: SuperAdmin = Depends(get_current_super_admin)
):
    try:
        trigger_ssl_provisioning()
        return {
            "status": "success",
            "message": "SSL renewal triggered successfully. The host automation will execute Certbot and reload Nginx shortly."
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to write renewal trigger file: {str(e)}"
        )
