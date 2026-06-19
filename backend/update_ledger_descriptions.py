import os
import sys

# Setup module path resolution
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database.db import MasterSessionLocal, get_tenant_session
from app.database.master_models import Tenant
from app.database.models import Ledger, Collection, BankDeposit
from sqlalchemy import select

def update_all_tenants():
    # 1. Get all active tenants from master DB
    master_db = MasterSessionLocal()
    try:
        tenants = master_db.query(Tenant).filter(Tenant.status == "active").all()
        print(f"Found {len(tenants)} active tenants in master database.")
    except Exception as e:
        print(f"Error reading master database: {e}")
        return
    finally:
        master_db.close()

    # 2. Update ledger descriptions for each tenant
    for tenant in tenants:
        print(f"\n==================================================")
        print(f"Processing Tenant Subdomain: {tenant.subdomain!r} (DB: {tenant.db_name!r})")
        print(f"==================================================")
        
        # Override environment for safety/compatibility
        os.environ["TEST_TENANT_ID"] = tenant.subdomain
        
        db = None
        try:
            db = get_tenant_session(tenant.subdomain)
            ledgers = db.scalars(select(Ledger)).all()
            updated_count = 0
            
            print(f"Analyzing {len(ledgers)} ledger records...")
            for entry in ledgers:
                new_desc = None
                
                # Case 1: Collection (Credit)
                if entry.transaction_type == "credit" and entry.collection_id is not None:
                    new_desc = "cash in"
                
                # Case 2: Deposit (Debit)
                elif entry.deposit_id is not None:
                    # Fetch corresponding deposit
                    dep = db.scalar(select(BankDeposit).where(BankDeposit.id == entry.deposit_id))
                    if dep:
                        if dep.deposit_type == "retailer":
                            new_desc = "cash out"
                        elif dep.deposit_type == "virtual":
                            if dep.payment_mode == "refund" or getattr(dep, "is_refund", False):
                                new_desc = "move to distributor"
                            else:
                                new_desc = "virtual transfer"
                    else:
                        # Fallback if deposit record is missing but description matches virtual transfer
                        desc_lower = (entry.description or "").lower()
                        if "refund" in desc_lower or "move to distributor" in desc_lower:
                            new_desc = "move to distributor"
                        elif "virtual" in desc_lower:
                            new_desc = "virtual transfer"
                        elif "cash out" in desc_lower or "payout" in desc_lower:
                            new_desc = "cash out"
                
                # Fallback if no linked IDs
                else:
                    desc_lower = (entry.description or "").lower()
                    if "opening balance" in desc_lower:
                        pass
                    elif "collection" in desc_lower or "cash in" in desc_lower:
                        new_desc = "cash in"
                    elif "refund" in desc_lower or "move to distributor" in desc_lower:
                        new_desc = "move to distributor"
                    elif "virtual" in desc_lower:
                        new_desc = "virtual transfer"
                    elif "cash out" in desc_lower or "payout" in desc_lower or entry.transaction_type == "debit":
                        new_desc = "cash out"
                
                if new_desc and entry.description != new_desc:
                    print(f"  -> Updating Ledger {entry.id}: {entry.description!r} -> {new_desc!r}")
                    entry.description = new_desc
                    updated_count += 1
            
            db.commit()
            print(f"Successfully updated {updated_count} ledger entries for tenant {tenant.subdomain!r}.")
        except Exception as e:
            print(f"Error processing tenant {tenant.subdomain!r}: {e}")
            if db:
                db.rollback()
        finally:
            if db:
                db.close()

if __name__ == "__main__":
    update_all_tenants()
