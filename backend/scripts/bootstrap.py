import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import settings
from app.database.db import Base, master_engine, MasterSessionLocal, get_tenant_connection_string
from app.database.master_models import Tenant, SuperAdmin
from app.database.models import User as TenantUser
from app.core.security import get_password_hash

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

def bootstrap():
    print("Starting CrediFlow Multi-Tenant Bootstrapping...")

    # 1. Connect to postgres database to create master database if it doesn't exist
    pg_url = f"postgresql://{settings.DB_USER}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/postgres"
    pg_engine = create_engine(pg_url, isolation_level="AUTOCOMMIT")
    
    with pg_engine.connect() as conn:
        # Check if master DB exists
        result = conn.execute(text("SELECT 1 FROM pg_database WHERE datname='crediiflow_master'"))
        if not result.fetchone():
            print("Creating master database 'crediiflow_master'...")
            conn.execute(text("CREATE DATABASE crediiflow_master"))
        else:
            print("Master database 'crediiflow_master' already exists.")
            
    # 2. Initialize master tables (Tenants, SuperAdmins)
    print("Initializing master tables...")
    Base.metadata.create_all(bind=master_engine)
    print("Master tables initialized successfully.")

    # 3. Create default tenant 'do-it-services' if not exists
    master_db = MasterSessionLocal()
    try:
        tenant = master_db.query(Tenant).filter(Tenant.subdomain == "do-it-services").first()
        if not tenant:
            # Check if old 'do-it' tenant exists and rename it
            old_tenant = master_db.query(Tenant).filter(Tenant.subdomain == "do-it").first()
            if old_tenant:
                print("Migrating existing 'do-it' tenant subdomain to 'do-it-services'...")
                old_tenant.subdomain = "do-it-services"
                master_db.commit()
                tenant = old_tenant
            else:
                print("Creating default tenant 'do-it-services'...")
                tenant = Tenant(
                    name="DO IT SERVICES",
                    subdomain="do-it-services",
                    db_name="crediiflow_doit",
                    status="active"
                )
                master_db.add(tenant)
                master_db.commit()
                print("Tenant 'do-it-services' registered in master DB.")
        else:
            print("Tenant 'do-it-services' already registered.")
            
        # Create default Super Admin if none exists
        super_admin = master_db.query(SuperAdmin).filter(SuperAdmin.username == "superadmin").first()
        if not super_admin:
            print("Creating default Super Admin...")
            super_admin = SuperAdmin(
                name="CrediFlow Admin",
                username="superadmin",
                password_hash=get_password_hash("superpass123"),
                is_active=True
            )
            master_db.add(super_admin)
            master_db.commit()
            print("Super Admin 'superadmin' created with password 'superpass123'.")
    finally:
        master_db.close()

    # 4. Create database for 'do-it' if it doesn't exist
    with pg_engine.connect() as conn:
        result = conn.execute(text("SELECT 1 FROM pg_database WHERE datname='crediiflow_doit'"))
        if not result.fetchone():
            print("Creating database 'crediiflow_doit'...")
            conn.execute(text("CREATE DATABASE crediiflow_doit"))
        else:
            print("Database 'crediiflow_doit' already exists.")

    # 5. Initialize client tables inside 'do-it' DB
    tenant_url = get_tenant_connection_string("crediiflow_doit")
    tenant_engine = create_engine(tenant_url)
    print("Initializing tenant tables inside 'crediiflow_doit'...")
    Base.metadata.create_all(bind=tenant_engine)
    print("Tenant tables initialized.")

    # 6. Seed tenant admin and staff accounts
    TenantSession = sessionmaker(bind=tenant_engine)
    tenant_db = TenantSession()
    try:
        admin_exists = tenant_db.query(TenantUser).filter(TenantUser.phone == "7900671145").first()
        if not admin_exists:
            print("Seeding Tenant Admin...")
            new_admin = TenantUser(
                name="Admin User",
                phone="7900671145",
                password_hash=get_password_hash("pass123"),
                role="admin"
            )
            tenant_db.add(new_admin)
            
        staff_exists = tenant_db.query(TenantUser).filter(TenantUser.phone == "9917128864").first()
        if not staff_exists:
            print("Seeding Tenant Staff...")
            new_staff = TenantUser(
                name="Staff User",
                phone="9917128864",
                password_hash=get_password_hash("pass123"),
                role="staff"
            )
            tenant_db.add(new_staff)
        tenant_db.commit()
        print("Tenant seeding complete.")
    finally:
        tenant_db.close()

    print("=== Bootstrapping completed successfully! ===")

if __name__ == "__main__":
    bootstrap()
