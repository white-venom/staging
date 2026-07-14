import os
import sys
from sqlalchemy import create_engine, text

# Add backend directory to sys.path so app modules can be resolved
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database.db import MasterSessionLocal, get_tenant_connection_string
from app.database.master_models import Tenant

session = MasterSessionLocal()
try:
    tenants = session.query(Tenant).all()
    for t in tenants:
        print(f"\n────────────────────────────────────────")
        print(f"Tenant: '{t.subdomain}' (Database: '{t.db_name}')")
        try:
            url = get_tenant_connection_string(t.db_name)
            engine = create_engine(url)
            with engine.connect() as conn:
                res = conn.execute(text("SELECT id, retailer_name, is_active FROM retailers")).all()
                print("Retailers in DB:")
                for r in res:
                    print(f"  - Name: {r[1]}, ID: {r[0]}, is_active: {r[2]}")
        except Exception as ex:
            print(f"Error querying tenant database: {ex}")
finally:
    session.close()
