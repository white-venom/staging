import os
import sys
from sqlalchemy import create_engine, text

# Add backend directory to sys.path so app modules can be resolved
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database.db import MasterSessionLocal, get_tenant_connection_string
from app.database.master_models import Tenant

def fix_column():
    print("🛠️ Starting Fix for Portals Column...")
    
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

    print(f"Found {len(tenant_list)} tenant(s) to check.")

    for subdomain, db_name in tenant_list:
        print(f"\n────────────────────────────────────────")
        print(f"Checking/fixing database for tenant '{subdomain}' (Database: '{db_name}')...")
        try:
            url = get_tenant_connection_string(db_name)
            engine = create_engine(url)
            with engine.connect() as conn:
                # Add the column if it doesn't exist
                conn.execute(text("ALTER TABLE portals ADD COLUMN IF NOT EXISTS show_in_online_payment BOOLEAN NOT NULL DEFAULT FALSE;"))
                conn.commit()
                print(f"✅ Successfully checked/updated database '{db_name}'!")
        except Exception as e:
            print(f"❌ Failed to update database '{db_name}': {e}")

if __name__ == "__main__":
    fix_column()
