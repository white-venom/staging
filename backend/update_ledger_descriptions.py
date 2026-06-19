import os
import sys
import uuid
from decimal import Decimal

# Tell the app configuration to load for 'do-it' tenant
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ["TEST_TENANT_ID"] = "do-it"

from app.database.db import get_tenant_session
from app.database.models import Ledger, Collection, BankDeposit
from sqlalchemy import select

def update_descriptions():
    db = get_tenant_session("do-it")
    try:
        # Fetch all ledger entries
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
                        if dep.payment_mode == "refund" or dep.is_refund:
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
                if "collection" in desc_lower or "cash in" in desc_lower:
                    new_desc = "cash in"
                elif "refund" in desc_lower or "move to distributor" in desc_lower:
                    new_desc = "move to distributor"
                elif "virtual" in desc_lower:
                    new_desc = "virtual transfer"
                elif "cash out" in desc_lower or "payout" in desc_lower or entry.transaction_type == "debit":
                    new_desc = "cash out"
            
            if new_desc and entry.description != new_desc:
                print(f"Updating Ledger {entry.id}: {entry.description!r} -> {new_desc!r}")
                entry.description = new_desc
                updated_count += 1
                
        db.commit()
        print(f"Successfully updated {updated_count} ledger entries.")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    update_descriptions()
