import os
import sys

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlalchemy import create_engine, inspect
from app.core.config import settings
from app.database.db import get_tenant_connection_string

def check_db_cols():
    print("🔍 Checking columns in databases...")
    
    # 1. Master DB
    print(f"\n--- Master DB ({settings.MASTER_DATABASE_URL.split('/')[-1]}) ---")
    try:
        engine = create_engine(settings.MASTER_DATABASE_URL)
        inspector = inspect(engine)
        if 'business_settings' in inspector.get_table_names():
            columns = [c['name'] for c in inspector.get_columns('business_settings')]
            print(f"business_settings columns: {columns}")
        else:
            print("business_settings table does not exist.")
    except Exception as e:
        print(f"Error: {e}")

    # 2. Tenant DBs
    tenants = [
        ("do-it-services", "crediiflow_do_it_services"),
        ("do-it", "crediiflow_doit")
    ]
    for subdomain, db_name in tenants:
        print(f"\n--- Tenant DB '{subdomain}' ({db_name}) ---")
        try:
            url = get_tenant_connection_string(db_name)
            engine = create_engine(url)
            inspector = inspect(engine)
            if 'business_settings' in inspector.get_table_names():
                columns = [c['name'] for c in inspector.get_columns('business_settings')]
                print(f"business_settings columns: {columns}")
            else:
                print("business_settings table does not exist.")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    check_db_cols()
