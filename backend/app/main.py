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
    
    # Safety Seed: Ensure at least one admin and one staff exist
    db = SessionLocal()
    try:
        admin_exists = db.query(UserModel).filter(UserModel.phone == "7900671145").first()
        if not admin_exists:
            new_admin = UserModel(
                name="Admin User",
                phone="7900671145",
                password_hash=get_password_hash("7900671145"),
                role="admin"
            )
            db.add(new_admin)
            
        staff_exists = db.query(UserModel).filter(UserModel.phone == "9917128864").first()
        if not staff_exists:
            new_staff = UserModel(
                name="Staff User",
                phone="9917128864",
                password_hash=get_password_hash("9917128864"),
                role="staff"
            )
            db.add(new_staff)
        db.commit()
    finally:
        db.close()


# Configure CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "https://do-it-services.vercel.app",
        "https://do-it-services-sujeet-kansals-projects.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app", # Dynamically allow all Vercel previews
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


@app.get("/", tags=["Health Check"])
def root(db: Session = Depends(get_db)):
    try:
        # Simple query to check DB connectivity
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
        
    return {
        "status": "healthy",
        "database": db_status,
        "service": settings.PROJECT_NAME,
        "version": "1.0.0"
    }


if __name__ == "__main__":
    pass
