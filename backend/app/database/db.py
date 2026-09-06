import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session
from app.core.config import settings
from fastapi import Request, HTTPException

# Master DB setup for central routing
master_engine = create_engine(
    settings.MASTER_DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_recycle=1800,
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

# Dictionaries to cache engines, sessionmakers, & db_names per tenant
_tenant_engines = {}
_tenant_sessionmakers = {}
_tenant_db_names = {}
_tenant_status_cache: dict[str, tuple[str, float]] = {}  # subdomain -> (db_name, verified_at_timestamp)
TENANT_STATUS_CACHE_TTL = 30.0  # seconds

import urllib.parse
import time

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
            pool_timeout=30,
            pool_recycle=1800,
            pool_pre_ping=True
        )
    return _tenant_engines[db_name]

class TenantSuspendedError(Exception):
    """Raised when a tenant subdomain resolves to a real tenant that exists but
    isn't active (e.g. suspended) -- kept distinct from a bare "not found" so
    callers can return a clear 403 instead of an indistinguishable 404."""
    def __init__(self, subdomain: str, status: str):
        self.subdomain = subdomain
        self.status = status
        super().__init__(f"Tenant '{subdomain}' is {status}, not active")


def get_tenant_session(tenant_subdomain: str) -> Session:
    now = time.time()
    cached_status = _tenant_status_cache.get(tenant_subdomain)

    # Re-validate with Master DB if cache expired (>30s) or missing
    if not cached_status or (now - cached_status[1] > TENANT_STATUS_CACHE_TTL):
        master_db = MasterSessionLocal()
        try:
            from app.database.master_models import Tenant
            tenant = master_db.query(Tenant).filter(Tenant.subdomain == tenant_subdomain).first()
            if not tenant:
                fallback_subdomain = "do-it-services" if tenant_subdomain == "do-it" else ("do-it" if tenant_subdomain == "do-it-services" else None)
                if fallback_subdomain:
                    tenant = master_db.query(Tenant).filter(Tenant.subdomain == fallback_subdomain).first()
            if not tenant:
                _tenant_status_cache.pop(tenant_subdomain, None)
                _tenant_db_names.pop(tenant_subdomain, None)
                raise ValueError(f"Tenant '{tenant_subdomain}' not found")
            if tenant.status != "active":
                _tenant_status_cache.pop(tenant_subdomain, None)
                _tenant_db_names.pop(tenant_subdomain, None)
                raise TenantSuspendedError(tenant_subdomain, tenant.status)

            db_name = tenant.db_name
            _tenant_db_names[tenant_subdomain] = db_name
            _tenant_status_cache[tenant_subdomain] = (db_name, now)
        finally:
            master_db.close()
    else:
        db_name = cached_status[0]

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


def evict_tenant_cache(identifier: str):
    """Remove cached engine, sessionmaker, and subdomain mappings for a deleted, renamed,
    or suspended tenant. Accepts either db_name or subdomain."""
    if not identifier:
        return
    # Direct engine eviction if identifier is db_name
    engine = _tenant_engines.pop(identifier, None)
    _tenant_sessionmakers.pop(identifier, None)

    # Subdomain mapping eviction
    mapped_db = _tenant_db_names.pop(identifier, None)
    if mapped_db:
        e = _tenant_engines.pop(mapped_db, None)
        _tenant_sessionmakers.pop(mapped_db, None)
        if e and not engine:
            engine = e

    for sub, db in list(_tenant_db_names.items()):
        if db == identifier or sub == identifier:
            _tenant_db_names.pop(sub, None)
            e = _tenant_engines.pop(db, None)
            _tenant_sessionmakers.pop(db, None)
            if e and not engine:
                engine = e

    if engine:
        try:
            engine.dispose()
        except Exception:
            pass

# Shared tenant-subdomain resolution (header -> subdomain -> env fallback), used
# by get_db and by anything else that needs to know "which tenant is this
# request for" without needing a live DB session yet (e.g. resolving the
# tenant's superadmin-controlled settings row in the master DB).
def resolve_tenant_subdomain(request: Request = None) -> str | None:
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
        # Fallback for dev scripts / pytest / localhost
        tenant_id = os.getenv("TEST_TENANT_ID") or settings.TEST_TENANT_ID

    return tenant_id



def get_current_tenant_row(request: Request = None):
    """Look up the master-DB Tenant row for the tenant this request belongs to.
    Returns None if it can't be resolved -- callers should fall back to sane
    defaults rather than fail the whole request over a settings lookup."""
    subdomain = resolve_tenant_subdomain(request)
    if not subdomain:
        return None
    from app.database.master_models import Tenant
    master_db = MasterSessionLocal()
    try:
        tenant = master_db.query(Tenant).filter(Tenant.subdomain == subdomain).first()
        if not tenant:
            fallback_subdomain = "do-it-services" if subdomain == "do-it" else ("do-it" if subdomain == "do-it-services" else None)
            if fallback_subdomain:
                tenant = master_db.query(Tenant).filter(Tenant.subdomain == fallback_subdomain).first()
        if tenant:
            master_db.expunge(tenant)
        return tenant
    finally:
        master_db.close()


# DB Dependency generator helper (for FastAPI integration)
# Automatically extracts the tenant from header, subdomain, or environment variables
def get_db(request: Request = None):
    tenant_id = resolve_tenant_subdomain(request)

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="X-Tenant-ID header, tenant subdomain, or TEST_TENANT_ID env var is required"
        )

    try:
        db = get_tenant_session(tenant_id)
    except TenantSuspendedError as e:
        raise HTTPException(
            status_code=403,
            detail=f"This tenant account has been {e.status}. Please contact support to reactivate it."
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    try:
        yield db
    finally:
        db.close()

