import uuid
import os
import secrets
import httpx
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from pydantic import BaseModel, Field, EmailStr, field_validator
from sqlalchemy import select, text, create_engine, func, desc
from sqlalchemy.orm import Session, sessionmaker

from app.database.db import get_master_db, MasterSessionLocal, Base, get_tenant_connection_string, get_tenant_engine, evict_tenant_cache
from app.database.master_models import Tenant, SuperAdmin, SuperAdminPasswordReset
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
    role: str = "full"

class TenantCreateRequest(BaseModel):
    name: str = Field(..., max_length=100)
    subdomain: str = Field(..., max_length=50, pattern=r"^[a-z0-9-]+$")
    admin_name: str = Field(..., max_length=100)
    admin_phone: str = Field(..., max_length=20)
    admin_password: str = Field(..., min_length=6)
    # Not persisted anywhere (the tenant's own `users` table has no email
    # column) -- used transiently, once, to send the onboarding welcome email.
    admin_email: Optional[str] = Field(None, max_length=255)

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
    edit_window_minutes: int = 10
    delete_window_minutes: int = 10
    tenant_admin_can_edit_entities: bool = False
    time_window_lock_enabled: bool = True
    admin_edit_window_minutes: int = 30
    admin_delete_window_minutes: int = 30

    class Config:
        from_attributes = True


class TenantControlsRequest(BaseModel):
    """Superadmin-only, per-tenant controls -- see items #2, #3, #4."""
    edit_window_minutes: int = Field(10, description="Staff edit window, minutes. -1 = unlimited")
    delete_window_minutes: int = Field(10, description="Staff delete window, minutes. -1 = unlimited")
    tenant_admin_can_edit_entities: bool = Field(
        False, description="If true, delegate Retailer/Staff/Store/balance editing back to this tenant's own admin."
    )
    time_window_lock_enabled: bool = Field(
        True, description="Master toggle for the whole edit/delete time-window + downstream-cash-use lock feature."
    )
    admin_edit_window_minutes: int = Field(30, description="Admin edit window, minutes. -1 = unlimited")
    admin_delete_window_minutes: int = Field(30, description="Admin delete window, minutes. -1 = unlimited")

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
        # A password reset bumps token_version, immediately invalidating every
        # token issued before it -- otherwise these JWTs are stateless and
        # would keep working right through a reset.
        if payload.get("tv") != admin.token_version:
            raise credentials_exception
        master_db.expunge(admin)
        return admin
    finally:
        master_db.close()


def require_full_admin(current_admin: SuperAdmin = Depends(get_current_super_admin)) -> SuperAdmin:
    """Item #3d: 'support' is a restricted, read-only superadmin role -- can
    view tenants/audit log/health but cannot create/edit/delete/suspend a
    tenant, change controls or feature flags, impersonate, or manage SSL.
    Use this in place of get_current_super_admin on any mutating endpoint."""
    if current_admin.role != "full":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your support role is read-only and cannot make changes. Ask a full superadmin."
        )
    return current_admin

# Routes
@router.post("/login", response_model=SuperAdminTokenResponse)
def login(login_data: SuperAdminLoginRequest, request: Request, db: Session = Depends(get_master_db)):
    admin = db.scalar(select(SuperAdmin).where(SuperAdmin.username == login_data.username))
    if not admin or not verify_password(login_data.password, admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )

    access_token = create_access_token(data={"sub": str(admin.id), "tv": admin.token_version})

    from app.logic.audit import log_audit_event
    log_audit_event(
        request, actor_type="superadmin", action="login",
        actor_id=admin.id, actor_name=admin.name,
        entity_type="SuperAdmin", entity_id=admin.id,
        description=f"Superadmin '{admin.name}' logged in",
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "name": admin.name,
        "username": admin.username,
        "role": admin.role
    }


class SuperAdminProfileResponse(BaseModel):
    id: uuid.UUID
    name: str
    username: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: str

    class Config:
        from_attributes = True


class SuperAdminProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)


@router.get("/profile", response_model=SuperAdminProfileResponse)
def get_own_profile(current_admin: SuperAdmin = Depends(get_current_super_admin)):
    return current_admin


@router.put("/profile", response_model=SuperAdminProfileResponse)
def update_own_profile(
    payload: SuperAdminProfileUpdate,
    request: Request,
    db: Session = Depends(get_master_db),
    current_admin: SuperAdmin = Depends(get_current_super_admin)
):
    """Part 1: self-service profile edit (name/email/phone) -- no OTP, direct
    update. Any superadmin (full or support) can edit their own profile; this
    isn't a tenant-mutating action so it isn't gated by require_full_admin."""
    admin = db.scalar(select(SuperAdmin).where(SuperAdmin.id == current_admin.id))
    if not admin:
        raise HTTPException(status_code=404, detail="Superadmin account not found")

    before = {"name": admin.name, "email": admin.email, "phone": admin.phone}
    changed = {}

    if payload.name is not None and payload.name != admin.name:
        admin.name = payload.name
        changed["name"] = payload.name
    if payload.email is not None and payload.email != admin.email:
        existing = db.scalar(select(SuperAdmin).where(SuperAdmin.email == payload.email, SuperAdmin.id != admin.id))
        if existing:
            raise HTTPException(status_code=400, detail="That email is already registered to another superadmin account.")
        admin.email = payload.email
        changed["email"] = payload.email
    if payload.phone is not None and payload.phone != admin.phone:
        admin.phone = payload.phone
        changed["phone"] = payload.phone

    if changed:
        db.commit()
        db.refresh(admin)

        from app.logic.audit import log_audit_event
        log_audit_event(
            request, actor_type="superadmin", action="update_own_profile",
            actor_id=admin.id, actor_name=admin.name,
            entity_type="SuperAdmin", entity_id=admin.id,
            before=before, after=changed,
            description=f"Superadmin '{admin.name}' updated their own profile ({', '.join(changed.keys())})",
        )

    return admin


# ─── Part 2: forgot-password via email OTP ──────────────────────────────────
OTP_EXPIRY_MINUTES = 10
OTP_RATE_LIMIT_MAX = 3
OTP_RATE_LIMIT_WINDOW_MINUTES = 15
OTP_MAX_FAILED_ATTEMPTS = 5


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_strength(cls, v: str) -> str:
        if not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
            raise ValueError("Password must be at least 8 characters and include at least one letter and one digit.")
        return v


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, request: Request, db: Session = Depends(get_master_db)):
    """Always returns the same generic message regardless of whether the email
    is registered, so this endpoint can't be used to enumerate superadmin
    accounts. Rate-limited per account (not globally) to 3 requests / 15 min."""
    from app.logic.audit import log_audit_event
    generic_response = {"message": "If that email is registered to a superadmin account, a verification code has been sent."}

    admin = db.scalar(select(SuperAdmin).where(SuperAdmin.email == payload.email))
    if not admin or not admin.is_active:
        return generic_response

    cutoff = datetime.utcnow() - timedelta(minutes=OTP_RATE_LIMIT_WINDOW_MINUTES)
    recent_count = db.scalar(
        select(func.count()).select_from(SuperAdminPasswordReset)
        .where(SuperAdminPasswordReset.super_admin_id == admin.id, SuperAdminPasswordReset.created_at >= cutoff)
    ) or 0
    if recent_count >= OTP_RATE_LIMIT_MAX:
        log_audit_event(
            request, actor_type="superadmin", action="forgot_password_rate_limited",
            actor_id=admin.id, actor_name=admin.name,
            entity_type="SuperAdmin", entity_id=admin.id,
            description=f"Password reset request for '{admin.email}' blocked -- {recent_count} requests in the last {OTP_RATE_LIMIT_WINDOW_MINUTES} minutes",
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many reset requests. Please wait a few minutes and try again."
        )

    otp = f"{secrets.randbelow(1000000):06d}"
    db.add(SuperAdminPasswordReset(
        super_admin_id=admin.id,
        otp_hash=get_password_hash(otp),
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES),
    ))
    db.commit()

    log_audit_event(
        request, actor_type="superadmin", action="forgot_password_requested",
        actor_id=admin.id, actor_name=admin.name,
        entity_type="SuperAdmin", entity_id=admin.id,
        description=f"Password reset OTP requested for '{admin.email}'",
    )

    try:
        from app.logic.email import send_password_reset_otp_email
        send_password_reset_otp_email(to_email=admin.email, admin_name=admin.name, otp=otp, expiry_minutes=OTP_EXPIRY_MINUTES)
    except Exception as e:
        print(f"[EMAIL] Failed to send password reset OTP to {admin.email}: {e}")

    return generic_response


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, request: Request, db: Session = Depends(get_master_db)):
    from app.logic.audit import log_audit_event
    invalid_response = HTTPException(status_code=400, detail="Invalid or expired verification code.")

    admin = db.scalar(select(SuperAdmin).where(SuperAdmin.email == payload.email))
    if not admin or not admin.is_active:
        raise invalid_response

    reset_row = db.scalar(
        select(SuperAdminPasswordReset)
        .where(SuperAdminPasswordReset.super_admin_id == admin.id, SuperAdminPasswordReset.used == False)
        .order_by(desc(SuperAdminPasswordReset.created_at))
        .limit(1)
    )

    def fail(reason: str):
        log_audit_event(
            request, actor_type="superadmin", action="reset_password_failed",
            actor_id=admin.id, actor_name=admin.name,
            entity_type="SuperAdmin", entity_id=admin.id,
            description=f"Failed password reset attempt for '{admin.email}': {reason}",
        )
        raise invalid_response

    if not reset_row:
        fail("no pending verification code")
    if reset_row.expires_at < datetime.utcnow():
        fail("verification code expired")
    if not verify_password(payload.otp, reset_row.otp_hash):
        reset_row.failed_attempts += 1
        if reset_row.failed_attempts >= OTP_MAX_FAILED_ATTEMPTS:
            reset_row.used = True  # burn it -- forces a fresh forgot-password request
        db.commit()
        fail(f"incorrect verification code (attempt {reset_row.failed_attempts}/{OTP_MAX_FAILED_ATTEMPTS})")

    reset_row.used = True
    admin.password_hash = get_password_hash(payload.new_password)
    admin.token_version += 1  # invalidates every token issued before this reset
    db.commit()

    log_audit_event(
        request, actor_type="superadmin", action="reset_password_succeeded",
        actor_id=admin.id, actor_name=admin.name,
        entity_type="SuperAdmin", entity_id=admin.id,
        description=f"Password reset succeeded for '{admin.email}'; all existing sessions invalidated",
    )

    return {"message": "Password reset successfully. Please sign in with your new password."}


@router.post("/tenants", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
def create_tenant(
    tenant_data: TenantCreateRequest,
    db: Session = Depends(get_master_db),
    current_admin: SuperAdmin = Depends(require_full_admin)
):
    # Check if subdomain already exists
    existing = db.scalar(select(Tenant).where(Tenant.subdomain == tenant_data.subdomain))
    if existing:
        raise HTTPException(status_code=400, detail="Subdomain already registered")

    db_name = f"crediiflow_{tenant_data.subdomain.replace('-', '_')}"

    # A stale/renamed subdomain elsewhere in this table could let a *different*
    # subdomain string past the check above while still computing the same
    # db_name (this exact scenario happened: the real tenant's subdomain had
    # drifted to a legacy value, so "do-it-services" looked unregistered here
    # even though its db_name -- crediiflow_do_it_services -- was already the
    # real tenant's database). Catching that collision here, before touching
    # any database, turns it into a clean 400 instead of a mid-seeding crash
    # against someone else's live data.
    existing_db_name = db.scalar(select(Tenant).where(Tenant.db_name == db_name))
    if existing_db_name:
        raise HTTPException(
            status_code=400,
            detail=f"A tenant already uses database '{db_name}' (registered under subdomain '{existing_db_name.subdomain}'). Choose a different subdomain."
        )

    # Create database and run migrations/seed
    try:
        # Create physical database and schema
        pg_url = f"postgresql://{settings.DB_USER}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/postgres"
        pg_engine = create_engine(pg_url, isolation_level="AUTOCOMMIT")
        try:
            with pg_engine.connect() as conn:
                result = conn.execute(text(f"SELECT 1 FROM pg_database WHERE datname='{db_name}'"))
                if result.fetchone():
                    raise HTTPException(
                        status_code=409,
                        detail=f"Database '{db_name}' already exists on the server but isn't registered to any tenant (likely an orphan from a previous deletion). It must be dropped manually before this subdomain can be used."
                    )
                conn.execute(text(f"CREATE DATABASE {db_name}"))
        finally:
            pg_engine.dispose()
        
        # Populate tables
        tenant_engine = get_tenant_engine(db_name)
        
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

    except HTTPException:
        raise
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

    # Fire-and-forget onboarding email, same treatment as DNS/SSL above --
    # never fails tenant creation itself. Only sent if the superadmin supplied
    # an email at onboarding time (not a required field).
    if tenant_data.admin_email:
        try:
            from app.logic.email import send_tenant_onboarding_email
            login_url = f"https://{tenant_data.subdomain}.{CF_DOMAIN}"
            send_tenant_onboarding_email(
                to_email=tenant_data.admin_email,
                tenant_name=tenant_data.name,
                subdomain=tenant_data.subdomain,
                admin_name=tenant_data.admin_name,
                admin_phone=tenant_data.admin_phone,
                admin_password=tenant_data.admin_password,
                login_url=login_url,
            )
        except Exception as e:
            print(f"[EMAIL] Onboarding email dispatch failed for new tenant '{tenant_data.name}': {e}")

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

    tenant_engine = get_tenant_engine(tenant.db_name)
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


@router.get("/tenants/{tenant_id}/backup")
def download_tenant_backup(
    tenant_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_master_db),
    current_admin: SuperAdmin = Depends(require_full_admin)
):
    """Item #3e: on-demand backup for ONE tenant (distinct from the existing
    cluster-wide nightly backup_postgres_r2.sh, which dumps every database
    together and uploads to R2 -- not yet usable per-tenant, and R2 credentials
    aren't configured yet anyway, see docs/VPS_INFRASTRUCTURE.md §5). This
    doesn't depend on R2 at all: `postgresql-client` is already installed in
    this container (see Dockerfile), so pg_dump runs directly and streams the
    result back as a download -- no cloud storage leg required for this to work
    today. Gated to full-role superadmins and audit-logged, since a database
    dump contains every retailer/staff/financial record for that tenant."""
    import gzip
    import subprocess
    from fastapi.responses import Response as FastAPIResponse

    tenant = db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    env = os.environ.copy()
    env["PGPASSWORD"] = settings.DB_PASSWORD
    cmd = [
        "pg_dump",
        "-h", settings.DB_HOST,
        "-p", str(settings.DB_PORT),
        "-U", settings.DB_USER,
        "-d", tenant.db_name,
        "--no-owner", "--no-privileges",
    ]
    try:
        result = subprocess.run(cmd, env=env, capture_output=True, timeout=120)
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Backup timed out after 120 seconds -- this tenant's database may be too large for an on-demand dump.")
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="pg_dump is not available on this server.")

    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=f"pg_dump failed: {result.stderr.decode(errors='replace')[:300]}")

    compressed = gzip.compress(result.stdout)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"{tenant.subdomain}_backup_{timestamp}.sql.gz"

    from app.logic.audit import log_audit_event
    log_audit_event(
        request, actor_type="superadmin", action="tenant.backup_download",
        actor_id=current_admin.id, actor_name=current_admin.name,
        entity_type="Tenant", entity_id=tenant.id,
        description=f"Superadmin '{current_admin.name}' downloaded an on-demand backup of tenant '{tenant.name}' ({round(len(compressed) / (1024*1024), 2)} MB)",
        tenant_override_subdomain=tenant.subdomain,
    )

    return FastAPIResponse(
        content=compressed,
        media_type="application/gzip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/tenants/{tenant_id}/health")
def get_tenant_health(
    tenant_id: uuid.UUID,
    db: Session = Depends(get_master_db),
    current_admin: SuperAdmin = Depends(get_current_super_admin)
):
    """Item #3b: per-tenant health visibility -- distinct from the global
    /infra/status tab, this answers "is THIS ONE tenant okay" rather than "is
    the whole platform okay." Combines a live DB-connectivity ping with recent
    unhandled-exception history from tenant_error_logs."""
    from app.database.master_models import TenantErrorLog
    from datetime import timedelta

    tenant = db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    db_reachable = True
    db_error = None
    try:
        tenant_engine = get_tenant_engine(tenant.db_name)
        with tenant_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as e:
        db_reachable = False
        db_error = str(e)[:200]

    cutoff_24h = datetime.utcnow() - timedelta(hours=24)
    cutoff_7d = datetime.utcnow() - timedelta(days=7)

    error_count_24h = db.scalar(
        select(func.count()).select_from(TenantErrorLog).where(
            TenantErrorLog.tenant_id == tenant_id, TenantErrorLog.created_at >= cutoff_24h
        )
    ) or 0
    error_count_7d = db.scalar(
        select(func.count()).select_from(TenantErrorLog).where(
            TenantErrorLog.tenant_id == tenant_id, TenantErrorLog.created_at >= cutoff_7d
        )
    ) or 0

    recent_errors = db.scalars(
        select(TenantErrorLog)
        .where(TenantErrorLog.tenant_id == tenant_id)
        .order_by(TenantErrorLog.created_at.desc())
        .limit(10)
    ).all()

    return {
        "tenant_status": tenant.status,
        "maintenance_mode": tenant.maintenance_mode,
        "db_reachable": db_reachable,
        "db_error": db_error,
        "error_count_24h": error_count_24h,
        "error_count_7d": error_count_7d,
        "recent_errors": [
            {
                "id": str(e.id),
                "method": e.method,
                "path": e.path,
                "error_type": e.error_type,
                "error_message": e.error_message,
                "created_at": e.created_at.isoformat(),
            } for e in recent_errors
        ],
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
            tenant_engine = get_tenant_engine(t.db_name)
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
    current_admin: SuperAdmin = Depends(require_full_admin)
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
    current_admin: SuperAdmin = Depends(require_full_admin)
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
        tenant_engine = get_tenant_engine(tenant.db_name)
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


@router.put("/tenants/{tenant_id}/controls", response_model=TenantResponse)
def update_tenant_controls(
    tenant_id: uuid.UUID,
    payload: TenantControlsRequest,
    db: Session = Depends(get_master_db),
    current_admin: SuperAdmin = Depends(require_full_admin)
):
    """Superadmin-only per-tenant controls: staff edit/delete windows (item #2)
    and whether this tenant's own admin may edit Retailer/Staff/Store records
    and retailer balances directly, or whether that's superadmin-only (items
    #3, #4). Tenant admins have no endpoint that can touch these fields."""
    tenant = db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    if payload.edit_window_minutes != -1 and payload.edit_window_minutes < 1:
        raise HTTPException(status_code=400, detail="Staff edit window must be -1 (unlimited) or a positive number of minutes.")
    if payload.delete_window_minutes != -1 and payload.delete_window_minutes < 1:
        raise HTTPException(status_code=400, detail="Staff delete window must be -1 (unlimited) or a positive number of minutes.")
    if payload.admin_edit_window_minutes != -1 and payload.admin_edit_window_minutes < 1:
        raise HTTPException(status_code=400, detail="Admin edit window must be -1 (unlimited) or a positive number of minutes.")
    if payload.admin_delete_window_minutes != -1 and payload.admin_delete_window_minutes < 1:
        raise HTTPException(status_code=400, detail="Admin delete window must be -1 (unlimited) or a positive number of minutes.")

    tenant.edit_window_minutes = payload.edit_window_minutes
    tenant.delete_window_minutes = payload.delete_window_minutes
    tenant.tenant_admin_can_edit_entities = payload.tenant_admin_can_edit_entities
    tenant.time_window_lock_enabled = payload.time_window_lock_enabled
    tenant.admin_edit_window_minutes = payload.admin_edit_window_minutes
    tenant.admin_delete_window_minutes = payload.admin_delete_window_minutes
    db.commit()
    db.refresh(tenant)
    return tenant


@router.delete("/tenants/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tenant(
    tenant_id: uuid.UUID,
    db: Session = Depends(get_master_db),
    current_admin: SuperAdmin = Depends(require_full_admin)
):
    tenant = db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Try to drop the tenant's database to clean up resources
    try:
        pg_url = f"postgresql://{settings.DB_USER}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/postgres"
        pg_engine = create_engine(pg_url, isolation_level="AUTOCOMMIT")
        try:
            with pg_engine.connect() as conn:
                # Terminate active connections to the database to prevent drop database locks
                conn.execute(text(
                    f"SELECT pg_terminate_backend(pg_stat_activity.pid) "
                    f"FROM pg_stat_activity "
                    f"WHERE pg_stat_activity.datname = '{tenant.db_name}' "
                    f"AND pid <> pg_backend_pid()"
                ))
                conn.execute(text(f"DROP DATABASE IF EXISTS {tenant.db_name}"))
        finally:
            pg_engine.dispose()
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


@router.post("/tenants/{tenant_id}/impersonate")
def impersonate_tenant_admin(
    tenant_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_master_db),
    current_admin: SuperAdmin = Depends(require_full_admin)
):
    """Issue a real, fully valid access token for this tenant's admin account,
    for support purposes -- 'log in as this tenant's admin' without knowing
    their password. Every issuance is audit-logged (item #3a): this endpoint
    IS the moment of use, since a token that's never picked up never does
    anything. Restricted to full-role superadmins -- support/read-only cannot
    impersonate."""
    tenant = db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if tenant.status != "active":
        raise HTTPException(status_code=400, detail=f"Tenant is {tenant.status}, not active -- cannot impersonate.")

    tenant_engine = get_tenant_engine(tenant.db_name)
    TenantSession = sessionmaker(bind=tenant_engine)
    tenant_db = TenantSession()
    try:
        from app.database import models
        admin_user = tenant_db.query(models.User).filter(
            models.User.role == "admin", models.User.is_active == True
        ).first()
        if not admin_user:
            raise HTTPException(status_code=404, detail="This tenant has no active admin account to impersonate.")

        access_token = create_access_token(data={"sub": str(admin_user.id)})

        from app.logic.audit import log_audit_event
        log_audit_event(
            request, actor_type="superadmin", action="impersonate",
            actor_id=current_admin.id, actor_name=current_admin.name,
            entity_type="User", entity_id=admin_user.id,
            description=f"Superadmin '{current_admin.name}' impersonated admin '{admin_user.name}' on tenant '{tenant.name}'",
            tenant_override_subdomain=tenant.subdomain,
        )

        return {
            "access_token": access_token,
            "admin_id": str(admin_user.id),
            "admin_name": admin_user.name,
            "admin_phone": admin_user.phone,
            "subdomain": tenant.subdomain,
        }
    finally:
        tenant_db.close()


@router.get("/platform/pulse")
def get_platform_pulse(
    db: Session = Depends(get_master_db),
    current_admin: SuperAdmin = Depends(get_current_super_admin)
):
    """Item #4: aggregate, always-visible platform vitals for the command
    center header -- distinct from /infra/status (raw Postgres server
    metrics) and /tenants/{id}/health (one tenant's detail). This is the
    single-glance "is anything on fire right now" signal across every tenant."""
    from app.database.master_models import TenantErrorLog
    from datetime import timedelta

    total_tenants = db.scalar(select(func.count()).select_from(Tenant)) or 0
    active_tenants = db.scalar(select(func.count()).select_from(Tenant).where(Tenant.status == "active")) or 0
    suspended_tenants = total_tenants - active_tenants

    cutoff_24h = datetime.utcnow() - timedelta(hours=24)
    errors_24h = db.scalar(
        select(func.count()).select_from(TenantErrorLog).where(TenantErrorLog.created_at >= cutoff_24h)
    ) or 0
    tenants_with_errors_24h = db.scalar(
        select(func.count(func.distinct(TenantErrorLog.tenant_id))).select_from(TenantErrorLog).where(
            TenantErrorLog.created_at >= cutoff_24h, TenantErrorLog.tenant_id.is_not(None)
        )
    ) or 0

    return {
        "total_tenants": total_tenants,
        "active_tenants": active_tenants,
        "suspended_tenants": suspended_tenants,
        "errors_24h": errors_24h,
        "tenants_with_errors_24h": tenants_with_errors_24h,
    }


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
    current_admin: SuperAdmin = Depends(require_full_admin)
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

@router.post("/ssl/provision/{subdomain}")
def provision_ssl(
    subdomain: str,
    current_admin: SuperAdmin = Depends(require_full_admin)
):
    import time
    try:
        # 1. Trigger SSL provisioning
        trigger_ssl_provisioning()
        
        # 2. Wait up to 90 seconds for the trigger file to be consumed
        trigger_file = "/app/triggers/ssl_renew.trigger"
        timeout = 90
        start_time = time.time()
        
        while os.path.exists(trigger_file):
            if time.time() - start_time > timeout:
                return {
                    "status": "warning",
                    "message": f"Trigger sent but watcher didn't consume it within {timeout}s. SSL may still be provisioning."
                }
            time.sleep(2)
            
        # 3. Trigger consumed. Give nginx 2 seconds to reload just in case
        time.sleep(2)
        
        # 4. Verify HTTPS works
        verify_url = f"https://{subdomain}.{CF_DOMAIN}/"
        
        try:
            with httpx.Client(verify=True, timeout=10.0) as client:
                r = client.get(verify_url)
                # Any response means SSL handshake succeeded
                return {
                    "status": "success",
                    "message": f"SSL provisioned and verified for {subdomain}.{CF_DOMAIN}!"
                }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Trigger consumed, but HTTPS verification failed: {str(e)}"
            }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to provision SSL: {str(e)}"
        )
