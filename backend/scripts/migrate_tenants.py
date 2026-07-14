import os
import sys

# Add backend directory to sys.path so app modules can be resolved
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from alembic.config import Config
from alembic import command
from app.database.db import MasterSessionLocal, get_tenant_connection_string
from app.database.master_models import Tenant

def migrate_tenants():
    os.environ["RUNNING_TENANT_MIGRATIONS"] = "true"
    print("🚀 Starting Tenant Database Migrations...")
    
    # 1. Fetch all active tenants from the master DB
    session = MasterSessionLocal()
    try:
        tenants = session.query(Tenant).all()
        tenant_list = [(t.subdomain, t.db_name) for t in tenants]
    except Exception as e:
        print(f"❌ Failed to fetch tenants from master DB: {e}")
        sys.exit(1)
    finally:
        session.close()

    if not tenant_list:
        print("ℹ️ No tenants found in master database.")
        return

    print(f"Found {len(tenant_list)} tenant(s) to migrate.")

    # 2. Run Alembic upgrade head on each tenant database
    alembic_cfg = Config("alembic.ini")
    
    success_count = 0
    for subdomain, db_name in tenant_list:
        print(f"\n────────────────────────────────────────")
        print(f"Migrating tenant: '{subdomain}' (Database: '{db_name}')...")
        try:
            url = get_tenant_connection_string(db_name)
            escaped_url = url.replace("%", "%%")
            alembic_cfg.set_main_option("sqlalchemy.url", escaped_url)
            command.upgrade(alembic_cfg, "head")
            print(f"✅ Successfully migrated '{subdomain}'!")
            success_count += 1
        except Exception as e:
            print(f"❌ Failed to migrate tenant '{subdomain}': {e}")

    print(f"\n🏁 Tenant migrations completed. Success: {success_count}/{len(tenant_list)}")

if __name__ == "__main__":
    migrate_tenants()
