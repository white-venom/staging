import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session
from app.core.config import settings
from fastapi import Request, HTTPException

# Master DB setup for central routing
master_engine = create_engine(
    settings.MASTER_DATABASE_URL,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True
)
MasterSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=master_engine)

# Base class for modern SQLAlchemy 2.0 declarative models
class Base(DeclarativeBase):
    pass

# Helper to get master db session (for super admin tasks)
def get_master_db():
    db = MasterSessionLocal()
    try:
        yield db
    finally:
        db.close()

# Dictionaries to cache engines & sessionmakers per database
_tenant_engines = {}
_tenant_sessionmakers = {}

import urllib.parse

def get_tenant_connection_string(db_name: str) -> str:
    escaped_password = urllib.parse.quote_plus(settings.DB_PASSWORD)
    return f"postgresql://{settings.DB_USER}:{escaped_password}@{settings.DB_HOST}:{settings.DB_PORT}/{db_name}"

def get_tenant_engine(db_name: str):
    if db_name not in _tenant_engines:
        db_url = get_tenant_connection_string(db_name)
        _tenant_engines[db_name] = create_engine(
            db_url,
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True
        )
    return _tenant_engines[db_name]

def get_tenant_session(tenant_subdomain: str) -> Session:
    # 1. Fetch tenant from master database to resolve their DB name
    master_db = MasterSessionLocal()
    try:
        from app.database.master_models import Tenant
        tenant = master_db.query(Tenant).filter(Tenant.subdomain == tenant_subdomain).first()
        if not tenant:
            raise ValueError(f"Tenant '{tenant_subdomain}' not found")
        if tenant.status != "active":
            raise ValueError(f"Tenant '{tenant_subdomain}' is not active")
        db_name = tenant.db_name
    finally:
        master_db.close()

    # 2. Get or create sessionmaker for this tenant DB
    if db_name not in _tenant_sessionmakers:
        engine = get_tenant_engine(db_name)
        _tenant_sessionmakers[db_name] = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        
    return _tenant_sessionmakers[db_name]()


class SessionLocalHelper:
    def __call__(self) -> Session:
        tenant_id = os.getenv("TEST_TENANT_ID")
        if not tenant_id:
            # Try to find the first active tenant in master db
            master_db = MasterSessionLocal()
            try:
                from app.database.master_models import Tenant
                tenant = master_db.query(Tenant).filter(Tenant.status == "active").first()
                if tenant:
                    tenant_id = tenant.subdomain
            except Exception:
                pass
            finally:
                master_db.close()
        if not tenant_id:
            tenant_id = "do-it-services"
        return get_tenant_session(tenant_id)

SessionLocal = SessionLocalHelper()


def evict_tenant_cache(db_name: str):
    """Remove cached engine and sessionmaker for a deleted/renamed tenant DB.
    Call this after dropping the database so stale pool connections
    don't linger and bypass the 404 check in get_db."""
    engine = _tenant_engines.pop(db_name, None)
    _tenant_sessionmakers.pop(db_name, None)
    if engine:
        try:
            engine.dispose()
        except Exception:
            pass

# DB Dependency generator helper (for FastAPI integration)
# Automatically extracts the tenant from header, subdomain, or environment variables
def get_db(request: Request = None):
    tenant_id = None
    if request:
        tenant_id = request.headers.get("X-Tenant-ID")
        if not tenant_id:
            # Fallback to subdomain parsing (e.g. doit.crediiflow.in)
            host = request.headers.get("host", "")
            parts = host.split(".")
            if len(parts) >= 3:
                tenant_id = parts[0]
                if tenant_id in ("superadmin", "www", "api"):
                    tenant_id = None

    if not tenant_id:
        # Fallback for dev scripts / pytest
        tenant_id = os.getenv("TEST_TENANT_ID")

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="X-Tenant-ID header, tenant subdomain, or TEST_TENANT_ID env var is required"
        )

    try:
        db = get_tenant_session(tenant_id)
        try:
            yield db
        finally:
            db.close()
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

