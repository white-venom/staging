import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response
from pydantic import BaseModel, Field
from sqlalchemy import select, text, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.database.db import get_master_db, MasterSessionLocal, Base, get_tenant_connection_string
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
    subdomain: str = Field(..., max_length=50)
    admin_name: str = Field(..., max_length=100)
    admin_phone: str = Field(..., max_length=20)
    admin_password: str = Field(..., min_length=6)

class TenantMaintenanceRequest(BaseModel):
    maintenance_mode: bool

class TenantUpdateRequest(BaseModel):
    name: str = Field(..., max_length=100)
    status: str = Field(..., max_length=20)

class TenantResponse(BaseModel):
    id: uuid.UUID
    name: str
    subdomain: str
    db_name: str
    status: str
    maintenance_mode: bool
    created_at: datetime

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
    return new_tenant

@router.get("/tenants", response_model=List[TenantResponse])
def list_tenants(
    db: Session = Depends(get_master_db),
    current_admin: SuperAdmin = Depends(get_current_super_admin)
):
    tenants = db.scalars(select(Tenant)).all()
    return tenants

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
    db.commit()
    db.refresh(tenant)
    return tenant

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

    db.delete(tenant)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
