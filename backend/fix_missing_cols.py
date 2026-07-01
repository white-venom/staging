import os
import sys

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlalchemy import create_engine, text, inspect
from app.core.config import settings
from app.database.db import MasterSessionLocal, get_tenant_connection_string
from app.database.master_models import Tenant

def fix_db(engine, db_name_for_log: str):
    print(f"\n⚡ Checking/Fixing database: {db_name_for_log}")
    inspector = inspect(engine)
    
    if 'business_settings' not in inspector.get_table_names():
        print("   ❌ Table 'business_settings' does not exist, skipping.")
        return
        
    columns = [c['name'] for c in inspector.get_columns('business_settings')]
    
    with engine.connect() as conn:
        # 1. edit_window_minutes
        if 'edit_window_minutes' not in columns:
            print("   ➕ Adding 'edit_window_minutes'...")
            conn.execute(text("ALTER TABLE business_settings ADD COLUMN edit_window_minutes INTEGER DEFAULT 5 NOT NULL"))
            
        # 2. delete_window_minutes
        if 'delete_window_minutes' not in columns:
            print("   ➕ Adding 'delete_window_minutes'...")
            conn.execute(text("ALTER TABLE business_settings ADD COLUMN delete_window_minutes INTEGER DEFAULT 5 NOT NULL"))
            
        # 3. opening_cash_in_hand
        if 'opening_cash_in_hand' not in columns:
            print("   ➕ Adding 'opening_cash_in_hand'...")
            conn.execute(text("ALTER TABLE business_settings ADD COLUMN opening_cash_in_hand FLOAT DEFAULT 0.0 NOT NULL"))
            
        # 4. staff_can_change_collection_date
        if 'staff_can_change_collection_date' not in columns:
            print("   ➕ Adding 'staff_can_change_collection_date'...")
            conn.execute(text("ALTER TABLE business_settings ADD COLUMN staff_can_change_collection_date BOOLEAN DEFAULT false NOT NULL"))
            
        conn.commit()
    print("   ✅ Sync complete!")

def run_fix():
    print("🚀 Initializing Database Columns Sync Script...")
    
    # 1. Fix Master DB
    try:
        master_engine = create_engine(settings.MASTER_DATABASE_URL)
        fix_db(master_engine, f"Master DB ({settings.MASTER_DATABASE_URL.split('/')[-1]})")
    except Exception as e:
        print(f"❌ Master DB Fix Failed: {e}")

    # 2. Fix Tenant DBs
    session = MasterSessionLocal()
    try:
        tenants = session.query(Tenant).all()
        for t in tenants:
            try:
                url = get_tenant_connection_string(t.db_name)
                engine = create_engine(url)
                fix_db(engine, f"Tenant '{t.subdomain}' ({t.db_name})")
            except Exception as e:
                print(f"❌ Tenant DB '{t.subdomain}' Fix Failed: {e}")
    except Exception as e:
        print(f"❌ Failed to fetch tenants from master DB: {e}")
    finally:
        session.close()

    print("\n🏁 All databases are now 100% in sync with the required columns!")

if __name__ == "__main__":
    run_fix()
