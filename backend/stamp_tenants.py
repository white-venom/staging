import os
import sys

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from alembic.config import Config
from alembic import command
from app.database.db import MasterSessionLocal, get_tenant_connection_string
from app.database.master_models import Tenant

def stamp_tenant(tenant_subdomain: str, revision: str = "head"):
    print(f"🚀 Stamping Tenant Database '{tenant_subdomain}' to revision '{revision}'...")
    
    session = MasterSessionLocal()
    try:
        tenant = session.query(Tenant).filter(Tenant.subdomain == tenant_subdomain).first()
        if not tenant:
            print(f"❌ Tenant '{tenant_subdomain}' not found in master DB.")
            return
        db_name = tenant.db_name
    except Exception as e:
        print(f"❌ Failed to fetch tenant from master DB: {e}")
        return
    finally:
        session.close()

    alembic_cfg = Config("alembic.ini")
    try:
        url = get_tenant_connection_string(db_name)
        escaped_url = url.replace("%", "%%")
        alembic_cfg.set_main_option("sqlalchemy.url", escaped_url)
        command.stamp(alembic_cfg, revision)
        print(f"✅ Successfully stamped '{tenant_subdomain}' to '{revision}'!")
    except Exception as e:
        print(f"❌ Failed to stamp tenant '{tenant_subdomain}': {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python stamp_tenants.py <tenant_subdomain> [revision]")
        sys.exit(1)
    
    subdomain = sys.argv[1]
    rev = sys.argv[2] if len(sys.argv) > 2 else "head"
    stamp_tenant(subdomain, rev)
