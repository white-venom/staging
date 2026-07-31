import os
import sys
import json
import uuid
from datetime import datetime, date
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
from app.database.models import Base, Retailer, Portal, BankAccount, Collection, BankDeposit, Ledger
from app.logic.ledger import recalculate_balances

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

def run_reverse_migration():
    print("🚀 Starting Reverse Portal Migration Script...")
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    
    target_names = {
        "abhishek retailer portal reli pay",
        "cash portal",
        "dheeraj tomar reli pay portal",
        "jafer khan retailer portal soul pay",
        "nitish bhati reli pay portal",
        "rizwan retailer portal reli pay"
    }
    
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
                portals = tenant_db.query(Portal).all()
                portals_to_migrate = [
                    p for p in portals if p.name.strip().lower() in target_names
                ]
                
                if not portals_to_migrate:
                    print(f"[INFO] No matching portals found to migrate back in tenant '{tenant.subdomain}'.")
                    continue
                    
                print(f"[INFO] Found {len(portals_to_migrate)} portals to migrate back:")
                for p in portals_to_migrate:
                    print(f"  * {p.name}")
                    
                for p in portals_to_migrate:
                    p_name = p.name.strip()
                    
                    # Create a brand new Retailer
                    print(f"  [INFO] Creating Retailer '{p_name}'...")
                    retailer = Retailer(
                        retailer_name=p_name,
                        phone=f"99999{p.id.hex[:5]}",
                        address="New Delhi",
                        opening_to_give=p.opening_to_give,
                        opening_to_take=p.opening_to_take,
                        balance=p.balance
                    )
                    
                    phone_mapping = {
                        "abhishek retailer portal reli pay": "9999900014",
                        "cash portal": "9999900015",
                        "dheeraj tomar reli pay portal": "9999900050",
                        "jafer khan retailer portal soul pay": "9999900046",
                        "nitish bhati reli pay portal": "9999900107",
                        "rizwan retailer portal reli pay": "9999900013"
                    }
                    mapped_phone = phone_mapping.get(p_name.lower())
                    if mapped_phone:
                        retailer.phone = mapped_phone
                        
                    tenant_db.add(retailer)
                    tenant_db.commit()
                    tenant_db.refresh(retailer)
                    print(f"  [INFO] Created Retailer ID: {retailer.id} with phone {retailer.phone}")
                    
                    # Get primary bank account of this portal
                    primary_account = tenant_db.scalar(
                        select(BankAccount).where(BankAccount.portal_id == p.id).order_by(BankAccount.created_at)
                    )
                    
                    if primary_account:
                        # Reassign Collections
                        collections = tenant_db.scalars(
                            select(Collection).where(Collection.bank_account_id == primary_account.id)
                        ).all()
                        if collections:
                            print(f"  [INFO] Reassigning {len(collections)} Collections back to Retailer...")
                            for col in collections:
                                col.retailer_id = retailer.id
                                col.bank_account_id = None
                            tenant_db.commit()
                            
                        # Reassign BankDeposits
                        deposits = tenant_db.scalars(
                            select(BankDeposit).where(BankDeposit.bank_account_id == primary_account.id)
                        ).all()
                        if deposits:
                            print(f"  [INFO] Reassigning {len(deposits)} BankDeposits back to Retailer...")
                            for dep in deposits:
                                dep.retailer_id = retailer.id
                                dep.bank_account_id = None
                                dep.deposit_type = "retailer"
                            tenant_db.commit()
                            
                        # Delete primary account
                        tenant_db.delete(primary_account)
                        tenant_db.commit()
                        
                    # Delete Portal
                    tenant_db.delete(p)
                    tenant_db.commit()
                    print(f"  [INFO] Deleted Portal and associated BankAccount.")
                    
                    # Recalculate retailer balance to generate Ledger entries
                    recalculate_balances(retailer.id, tenant_db)
                    tenant_db.commit()
                    print(f"  [INFO] Successfully migrated '{p_name}' back to Retailers directory.")
                    print(f"  [INFO] Recalculated Retailer balance: {float(retailer.balance)}")
                    
            except Exception as ex:
                print(f"[ERROR] Reverse migration failed for tenant '{tenant.subdomain}': {str(ex)}")
                tenant_db.rollback()
            finally:
                tenant_db.close()
    finally:
        master_db.close()

if __name__ == "__main__":
    run_reverse_migration()
