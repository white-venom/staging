import os
import sys
from sqlalchemy import create_engine, text

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database.db import MasterSessionLocal, get_tenant_connection_string
from app.database.db import MasterSessionLocal, get_tenant_connection_string
from app.database.master_models import Tenant, SuperAdmin

session = MasterSessionLocal()
try:
    print("\n================ MASTER DB: SUPER ADMINS ================")
    super_admins = session.query(SuperAdmin).all()
    for sa in super_admins:
        print(f"  - Username: {sa.username}, Name: {sa.name}, Role: {sa.role}, Active: {sa.is_active}")

    print("\n================ TENANTS & USERS ================")
    tenants = session.query(Tenant).all()
    for t in tenants:
        print(f"\n----------------------------------------")
        print(f"Tenant: '{t.name}' (Subdomain: '{t.subdomain}', DB: '{t.db_name}', Status: '{t.status}')")
        try:
            url = get_tenant_connection_string(t.db_name)
            engine = create_engine(url)
            with engine.connect() as conn:
                res = conn.execute(text("SELECT id, name, phone, role, is_active FROM users ORDER BY role, name")).all()
                print("Users in Tenant DB:")
                for u in res:
                    print(f"  - Name: {u[1]:<20} | Phone: {u[2]:<12} | Role: {u[3]:<7} | Active: {u[4]}")
        except Exception as ex:
            print(f"  Error querying tenant database '{t.db_name}': {ex}")
finally:
    session.close()

