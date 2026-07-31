import os
import sys
import json
import uuid
from datetime import datetime, date, timedelta
from decimal import Decimal
from sqlalchemy import create_engine, select, text, func
from sqlalchemy.orm import sessionmaker

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import settings
from app.database.db import master_engine, MasterSessionLocal, get_tenant_connection_string
from app.database.master_models import Tenant
from app.database.models import Base, Retailer, Portal, BankAccount, Collection, BankDeposit, Ledger, Store, PortalAdjustment

# Setup backup directory
BACKUP_DIR = "/app/triggers/backups" if os.path.exists("/app/triggers") else os.path.join(backend_dir, "triggers", "backups")

def backup_database(engine, filename):
    from sqlalchemy import inspect
    inspector = inspect(engine)
    backup_data = {}
    
    with engine.connect() as conn:
        for table_name in inspector.get_table_names():
            try:
                result = conn.execute(text(f'SELECT * FROM "{table_name}"'))
                columns = result.keys()
                rows = []
                for row in result:
                    row_dict = {}
                    for col, val in zip(columns, row):
                        if isinstance(val, (datetime, date)):
                            row_dict[col] = val.isoformat()
                        elif isinstance(val, Decimal):
                            row_dict[col] = float(val)
                        elif isinstance(val, uuid.UUID):
                            row_dict[col] = str(val)
                        else:
                            row_dict[col] = val
                    rows.append(row_dict)
                backup_data[table_name] = rows
            except Exception as e:
                print(f"[WARN] Failed to backup table '{table_name}': {str(e)}")
                
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(backup_data, f, indent=2)
    print(f"📦 Backup successfully created at: {filename}")

def run_portal_migration():
    print("🚀 Starting Portal Migration Script...")
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    
    # 1. Backup Master Database
    master_backup_path = os.path.join(BACKUP_DIR, f"master_backup_{timestamp}.json")
    try:
        backup_database(master_engine, master_backup_path)
    except Exception as e:
        print(f"[ERROR] Failed to backup master database: {str(e)}")
    
    # Get active tenants from master DB
    master_db = MasterSessionLocal()
    try:
        active_tenants = master_db.query(Tenant).filter(Tenant.status == "active").all()
        print(f"[INFO] Found {len(active_tenants)} active tenants to process.")
        
        for tenant in active_tenants:
            print(f"\nProcessing Tenant: '{tenant.subdomain}' (DB: '{tenant.db_name}')")
            tenant_url = get_tenant_connection_string(tenant.db_name)
            tenant_engine = create_engine(tenant_url)
            
            # 2. Backup Tenant Database
            tenant_backup_path = os.path.join(BACKUP_DIR, f"tenant_{tenant.subdomain}_backup_{timestamp}.json")
            try:
                backup_database(tenant_engine, tenant_backup_path)
            except Exception as e:
                print(f"[ERROR] Failed to backup tenant database '{tenant.db_name}', skipping migration for this tenant: {str(e)}")
                continue
                
            # Connect to Tenant database session
            TenantSession = sessionmaker(bind=tenant_engine)
            tenant_db = TenantSession()
            try:
                # Find retailers containing 'portal' (case-insensitive)
                retailers_to_migrate = tenant_db.scalars(
                    select(Retailer).where(Retailer.retailer_name.ilike("%portal%"))
                ).all()
                
                if not retailers_to_migrate:
                    print(f"[INFO] No portal retailers found in tenant '{tenant.subdomain}'.")
                    continue
                    
                print(f"[INFO] Found {len(retailers_to_migrate)} retailers to migrate:")
                for r in retailers_to_migrate:
                    print(f"  * {r.retailer_name} (ID: {r.id}, Balance: {r.balance})")
                    
                for r in retailers_to_migrate:
                    portal_name = r.retailer_name.strip()
                    
                    # Case-insensitive duplicate check
                    existing_portal = tenant_db.scalar(
                        select(Portal).where(func.lower(Portal.name) == portal_name.lower())
                    )
                    
                    if existing_portal:
                        print(f"  [WARN] Portal '{portal_name}' already exists. Reusing it.")
                        portal = existing_portal
                        primary_account = tenant_db.scalar(
                            select(BankAccount).where(BankAccount.portal_id == portal.id).order_by(BankAccount.created_at)
                        )
                        if not primary_account:
                            primary_account = BankAccount(
                                portal_id=portal.id,
                                bank_account_name="Primary Account"
                            )
                            tenant_db.add(primary_account)
                            tenant_db.commit()
                            tenant_db.refresh(primary_account)
                    else:
                        # Create a brand new Portal with opening balances from the Retailer
                        print(f"  [INFO] Creating Portal '{portal_name}'...")
                        portal = Portal(
                            name=portal_name,
                            opening_to_give=r.opening_to_give,
                            opening_to_take=r.opening_to_take,
                            balance=r.balance
                        )
                        tenant_db.add(portal)
                        tenant_db.commit()
                        tenant_db.refresh(portal)
                        
                        primary_account = BankAccount(
                            portal_id=portal.id,
                            bank_account_name="Primary Account"
                        )
                        tenant_db.add(primary_account)
                        tenant_db.commit()
                        tenant_db.refresh(portal)
                        
                    # Reassign Collections
                    collections = tenant_db.scalars(
                        select(Collection).where(Collection.retailer_id == r.id)
                    ).all()
                    if collections:
                        print(f"  [INFO] Reassigning {len(collections)} Collections to Portal bank account...")
                        for col in collections:
                            col.retailer_id = None
                            col.bank_account_id = primary_account.id
                        tenant_db.commit()
                        
                    # Reassign BankDeposits
                    deposits = tenant_db.scalars(
                        select(BankDeposit).where(BankDeposit.retailer_id == r.id)
                    ).all()
                    if deposits:
                        print(f"  [INFO] Reassigning {len(deposits)} BankDeposits to Portal bank account...")
                        for dep in deposits:
                            dep.retailer_id = None
                            dep.bank_account_id = primary_account.id
                            dep.deposit_type = "portal"
                        tenant_db.commit()
                        
                    # Delete Ledger entries for this retailer
                    ledger_delete_count = tenant_db.query(Ledger).filter(Ledger.retailer_id == r.id).delete()
                    print(f"  [INFO] Deleted {ledger_delete_count} Ledger entries.")
                    tenant_db.commit()
                    
                    # Delete any associated Store records
                    stores = tenant_db.scalars(select(Store).where(Store.retailer_id == r.id)).all()
                    if stores:
                        for st in stores:
                            tenant_db.query(Collection).filter(Collection.store_id == st.id).update({Collection.store_id: None})
                            tenant_db.delete(st)
                        tenant_db.commit()
                        print(f"  [INFO] Deleted {len(stores)} associated Store records.")
                        
                    # Delete the Retailer record
                    tenant_db.delete(r)
                    tenant_db.commit()
                    print(f"  [INFO] Retailer '{portal_name}' migrated successfully.")
                    
                    # Recalculate Portal balance to verify correctness
                    from app.routers.portals import _compute_portal_ledger
                    _, _, running_balance = _compute_portal_ledger(tenant_db, portal.id)
                    portal.balance = running_balance
                    tenant_db.commit()
                    print(f"  [INFO] Recalculated Portal '{portal_name}' balance: {float(portal.balance)}")
                    
            except Exception as ex:
                print(f"[ERROR] Migration failed for tenant '{tenant.subdomain}': {str(ex)}")
                tenant_db.rollback()
            finally:
                tenant_db.close()
                
    finally:
        master_db.close()

if __name__ == "__main__":
    run_portal_migration()
