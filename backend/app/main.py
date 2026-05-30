import os
from fastapi import FastAPI, Request, Depends
from fastapi.responses import JSONResponse
# Build Trigger: v1.0.1
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.database.db import get_db, engine, Base, SessionLocal
from app.database.models import User as UserModel
from app.core.security import get_password_hash

from app.core.config import settings
from app.routers.auth import router as auth_router
from app.routers.portals import router as portals_router
from app.routers.retailers import router as retailers_router
from app.routers.attendance import router as attendance_router
from app.routers.collections import router as collections_router
from app.routers.deposits import router as deposits_router
from app.routers.reports import router as reports_router
from app.routers.users import router as users_router
from app.routers.admin_settings import router as admin_settings_router

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
    Base.metadata.create_all(bind=engine)
    
    # Safety Seed: Ensure at least one admin and one staff exist (only in development and if SEED_ACCOUNTS is enabled)
    is_dev = settings.ENVIRONMENT == "development"
    if os.getenv("SEED_ACCOUNTS", "true").lower() == "true" and is_dev:
        db = SessionLocal()
        try:
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
        finally:
            db.close()

    # Trigger the 2-month odometer image cleanup in a background thread
    try:
        import threading
        import sys
        # Prepend backend directory to path if not present for running the script import safely
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
allow_origin_regex = r"https?://.*" if is_development else None

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,      # Crucial to allow HttpOnly cookies transmission
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Router Modules
app.include_router(auth_router)
app.include_router(portals_router)
app.include_router(retailers_router)
app.include_router(attendance_router)
app.include_router(collections_router)
app.include_router(deposits_router)
app.include_router(reports_router)
app.include_router(users_router)
app.include_router(admin_settings_router)

# Mount Static Files (For attendance meter images)
from fastapi.staticfiles import StaticFiles
static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")



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
