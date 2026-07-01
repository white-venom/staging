#!/usr/bin/env python3
import os
import sys

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlalchemy import create_engine, text, inspect
from app.core.config import settings
from app.database.db import MasterSessionLocal, get_tenant_connection_string
from app.database.master_models import Tenant

def run_migration_on_db(engine, db_name_for_log: str):
    print(f"\n⚡ Checking database: {db_name_for_log}")
    inspector = inspect(engine)
    
    if 'bank_deposits' not in inspector.get_table_names():
        print("   ❌ Table 'bank_deposits' does not exist, skipping.")
        return
        
    columns = [c['name'] for c in inspector.get_columns('bank_deposits')]
    
    if 'from_portal_id' in columns:
        print("   ✅ Column 'from_portal_id' already exists.")
        return

    print("   ➕ Adding 'from_portal_id' to bank_deposits table...")
    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE bank_deposits 
            ADD COLUMN from_portal_id UUID REFERENCES portals(id) ON DELETE SET NULL;
        """))
        conn.commit()
    print("   ✅ Migration complete for this database!")

def run_all_migrations():
    print("🚀 Running Portal-to-Portal Migration on all Tenant Databases...")
    
    # 1. Migrate Master DB (if applicable)
    try:
        master_engine = create_engine(settings.MASTER_DATABASE_URL)
        run_migration_on_db(master_engine, f"Master DB ({settings.MASTER_DATABASE_URL.split('/')[-1]})")
    except Exception as e:
        print(f"❌ Master DB Migration Failed: {e}")

    # 2. Migrate Tenant DBs
    session = MasterSessionLocal()
    try:
        tenants = session.query(Tenant).all()
        for t in tenants:
            try:
                url = get_tenant_connection_string(t.db_name)
                engine = create_engine(url)
                run_migration_on_db(engine, f"Tenant '{t.subdomain}' ({t.db_name})")
            except Exception as e:
                print(f"❌ Tenant DB '{t.subdomain}' Migration Failed: {e}")
    except Exception as e:
        print(f"❌ Failed to fetch tenants from master DB: {e}")
    finally:
        session.close()

    print("\n🏁 All database migrations executed successfully!")

if __name__ == "__main__":
    run_all_migrations()
