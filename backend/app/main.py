import os
from fastapi import FastAPI, Request, Depends
from fastapi.responses import JSONResponse
# Build Trigger: v1.0.2
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.database.db import get_db, Base, master_engine, get_tenant_session
from app.database.models import User as UserModel
from app.core.security import get_password_hash

from app.core.config import settings
from app.routers.auth import router as auth_router
from app.routers.portals import router as portals_router
from app.routers.bank_accounts import router as bank_accounts_router
from app.routers.retailers import router as retailers_router
from app.routers.attendance import router as attendance_router
from app.routers.collections import router as collections_router
from app.routers.deposits import router as deposits_router
from app.routers.reports import router as reports_router
from app.routers.users import router as users_router
from app.routers.admin_settings import router as admin_settings_router
from app.routers.super_admin import router as super_admin_router

# Bootstraps the FastAPI Application
app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/docs",      # Swagger interactive docs URL
    redoc_url="/redoc"     # Alternate ReDoc API representation
)

# Automatic Table Creation (Crucial for ephemeral cloud storage like Render's /tmp)
@app.on_event("startup")
def startup_event():
    # Initialize master models
    from app.database.master_models import Tenant, SuperAdmin
    Base.metadata.create_all(bind=master_engine)
    
    # 1. Automatically migrate 'do-it' subdomain to 'do-it-services' in master database
    try:
        from app.database.db import MasterSessionLocal
        from app.database.master_models import Tenant
        master_db = MasterSessionLocal()
        try:
            # Check if do-it-services already exists
            services_tenant = master_db.query(Tenant).filter(Tenant.subdomain == "do-it-services").first()
            if not services_tenant:
                old_tenant = master_db.query(Tenant).filter(Tenant.subdomain == "do-it").first()
                if old_tenant:
                    print("[INFO] Migrating subdomain 'do-it' to 'do-it-services' in master DB during startup...")
                    old_tenant.subdomain = "do-it-services"
                    master_db.commit()
        finally:
            master_db.close()
    except Exception as e:
        print(f"[WARN] Failed to automatically migrate 'do-it' subdomain during startup: {e}")

    # Proactive alter table check and seeding for default 'do-it-services' tenant
    try:
        db = get_tenant_session("do-it-services")
        from sqlalchemy import text
        tenant_engine = db.bind
        with tenant_engine.begin() as conn:
            try:
                conn.execute(text("ALTER TABLE business_settings ADD COLUMN auto_checkout_time VARCHAR(10) DEFAULT '20:00'"))
                print("[INFO] Column auto_checkout_time added to business_settings table successfully in do-it-services.")
            except Exception:
                # Column probably already exists, ignore
                pass

        # Seed CMS Retailer inside do-it-services
        from app.database.models import Retailer
        from sqlalchemy import select
        cms_retailer = db.scalar(select(Retailer).where(text("LOWER(retailer_name) = 'cms'")))
        if not cms_retailer:
            cms_retailer = Retailer(
                retailer_name="CMS",
                phone="0000000000",
                address="CMS Managed Stores",
                opening_to_give=0.00,
                opening_to_take=0.00,
                balance=0.00
            )
            db.add(cms_retailer)
            db.commit()
            print("[INFO] CMS retailer seeded successfully in do-it-services.")

        # Seed default admin and staff inside do-it-services if SEED_ACCOUNTS is enabled
        is_dev = settings.ENVIRONMENT == "development"
        if os.getenv("SEED_ACCOUNTS", "true").lower() == "true" and is_dev:
            admin_exists = db.query(UserModel).filter(UserModel.phone == "7900671145").first()
            if not admin_exists:
                new_admin = UserModel(
                    name="Admin User",
                    phone="7900671145",
                    password_hash=get_password_hash("pass123"),
                    role="admin"
                )
                db.add(new_admin)
                
            staff_exists = db.query(UserModel).filter(UserModel.phone == "9917128864").first()
            if not staff_exists:
                new_staff = UserModel(
                    name="Staff User",
                    phone="9917128864",
                    password_hash=get_password_hash("pass123"),
                    role="staff"
                )
                db.add(new_staff)
            db.commit()
        db.close()
    except Exception as e:
        print(f"[WARN] Failed to seed default tenant database 'do-it-services' during startup: {e}")

    # Update schemas (idempotent column checks) for all active tenants.
    # NOTE: this used to also run fix_historical_ledger_dates() on every boot, scanning
    # every ledger row of every tenant and racing against live traffic with no row
    # locking. That was a one-time historical correction, not an ongoing job — it has
    # been moved to scripts/fix_historical_ledger_dates_oneoff.py, run manually instead.
    try:
        from app.database.master_models import Tenant
        from app.database.db import MasterSessionLocal
        from sqlalchemy import text
        master_db = MasterSessionLocal()
        try:
            active_tenants = master_db.query(Tenant).filter(Tenant.status == "active").all()
            for tenant in active_tenants:
                print(f"[INFO] Running database schema checks for tenant '{tenant.subdomain}'...")
                try:
                    tenant_db = get_tenant_session(tenant.subdomain)
                    tenant_engine = tenant_db.bind
                    with tenant_engine.begin() as conn:
                        try:
                            conn.execute(text("ALTER TABLE business_settings ADD COLUMN auto_checkout_time VARCHAR(10) DEFAULT '20:00'"))
                        except Exception:
                            pass
                        try:
                            conn.execute(text("ALTER TABLE business_settings ADD COLUMN opening_cash_in_hand DOUBLE PRECISION DEFAULT 0.0"))
                            print(f"[INFO] Column opening_cash_in_hand added/verified for tenant '{tenant.subdomain}'.")
                        except Exception:
                            pass

                    tenant_db.close()
                except Exception as t_err:
                    print(f"[ERROR] Failed to run database updates/corrections for tenant '{tenant.subdomain}': {t_err}")
        finally:
            master_db.close()
    except Exception as e:
        print(f"[WARN] Failed to run global schema corrections during startup: {e}")
    
    # Trigger the 2-month odometer image cleanup in a background thread
    try:
        import threading
        import sys
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        parent_dir = os.path.dirname(backend_dir)
        if parent_dir not in sys.path:
            sys.path.insert(0, parent_dir)
        
        from delete_old_attendance_images import run_image_cleanup
        threading.Thread(target=run_image_cleanup, daemon=True).start()
        print("[INFO] Background thread for 2-month odometer image cleanup initiated.")
    except Exception as e:
        print(f"[ERROR] Failed to start background image cleanup thread: {str(e)}")


# Configure CORS Middleware
origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]

# Enable wildcard origin regex in local/development mode for easy Wi-Fi testing
is_development = settings.ENVIRONMENT == "development"
allow_origin_regex = r"https?://.*" if is_development else r"https://([a-zA-Z0-9-]+\.)*crediiflow\.in"

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,      # Crucial to allow HttpOnly cookies transmission
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

# Global catch-all exception handler to ensure ALL errors return CORS-compatible
# JSON responses. Without this, unhandled exceptions return plain-text 500 responses
# that bypass CORS headers, causing browsers to show "Failed to fetch" errors.
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=getattr(exc, "headers", None)
        )
    if isinstance(exc, RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={"detail": exc.errors()}
        )

    import traceback
    print(f"[ERROR] Unhandled exception: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"}
    )

# Register Router Modules
app.include_router(auth_router)
app.include_router(portals_router)
app.include_router(bank_accounts_router)
app.include_router(retailers_router)
app.include_router(attendance_router)
app.include_router(collections_router)
app.include_router(deposits_router)
app.include_router(reports_router)
app.include_router(users_router)
app.include_router(admin_settings_router)
app.include_router(super_admin_router)

# Mount Static Files (For attendance meter images)
from fastapi.staticfiles import StaticFiles
static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")



@app.get("/tenant/info", tags=["Tenant Info"])
def tenant_info(request: Request):
    from fastapi import HTTPException
    tenant_id = request.headers.get("X-Tenant-ID")
    if not tenant_id:
        host = request.headers.get("host", "")
        parts = host.split(".")
        if len(parts) >= 3:
            tenant_id = parts[0]
            if tenant_id in ("superadmin", "www", "api"):
                tenant_id = None
                
    if not tenant_id:
        tenant_id = os.getenv("TEST_TENANT_ID")
        
    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="X-Tenant-ID header, tenant subdomain, or TEST_TENANT_ID env var is required"
        )
        
    from app.database.master_models import Tenant
    from app.database.db import MasterSessionLocal
    
    master_db = MasterSessionLocal()
    try:
        tenant = master_db.query(Tenant).filter(Tenant.subdomain == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail=f"Tenant '{tenant_id}' not found")
        return {
            "id": tenant.id,
            "name": tenant.name,
            "subdomain": tenant.subdomain,
            "status": tenant.status,
            "maintenance_mode": tenant.maintenance_mode
        }
    finally:
        master_db.close()

@app.get("/", tags=["Health Check"])
def root(db: Session = Depends(get_db)):
    try:
        # Simple query to check DB connectivity
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        import logging
        logging.getLogger("uvicorn.error").error(f"Database health check failed: {e}")
        db_status = "disconnected"
        
    return {
        "status": "healthy",
        "database": db_status,
        "service": settings.PROJECT_NAME,
        "version": "1.0.0"
    }


if __name__ == "__main__":
    pass
