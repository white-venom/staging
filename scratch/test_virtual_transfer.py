import sys
import os
from decimal import Decimal

# Add backend directory to sys.path so we can import app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.database.db import SessionLocal
from app.database.models import Portal, Retailer, Ledger
from sqlalchemy import select, desc

def run_test():
    db = SessionLocal()
    print("[TEST] Connected to Database successfully.")
    
    # 1. Fetch any portal and any retailer
    portal = db.scalar(select(Portal).limit(1))
    retailer = db.scalar(select(Retailer).limit(1))
    
    if not portal or not retailer:
        print("[FAIL] Missing test records: Make sure portals and retailers are seeded!")
        db.close()
        return
        
    print(f"[TEST] Using Portal: {portal.portal_name} (Current Balance: {portal.balance})")
    print(f"[TEST] Using Retailer: {retailer.retailer_name} (Current Outstanding: {retailer.balance})")
    
    initial_portal_balance = portal.balance
    initial_retailer_balance = retailer.balance
    transfer_amount = Decimal("250.00")
    
    # Save a savepoint so we can rollback cleanly
    db.begin_nested()
    
    try:
        print("[TEST] Executing balance calculations...")
        # Step A: portal balance decrement
        portal.balance -= transfer_amount
        if portal.group:
            initial_group_balance = portal.group.balance
            portal.group.balance -= transfer_amount
            print(f"[TEST] Parent Group: {portal.group.name} (New Balance: {portal.group.balance})")
            
        # Step B: Get latest ledger
        latest_ledger = db.scalar(
            select(Ledger)
            .where(Ledger.retailer_id == retailer.id)
            .order_by(desc(Ledger.created_at), desc(Ledger.id))
            .limit(1)
        )
        
        if latest_ledger:
            prev_balance = latest_ledger.balance
        else:
            prev_balance = Decimal(str(retailer.opening_to_take or 0)) - Decimal(str(retailer.opening_to_give or 0))
            
        new_balance = prev_balance + transfer_amount
        
        # Step C: Log Ledger entry
        desc_text = f"Virtual Portal Transfer from {portal.portal_name} (Test Remarks)"
        ledger_entry = Ledger(
            retailer_id=retailer.id,
            transaction_type="debit",
            amount=transfer_amount,
            balance=new_balance,
            description=desc_text
        )
        db.add(ledger_entry)
        
        retailer.balance = new_balance
        db.flush()
        
        # Verify values
        print(f"[TEST] New Portal Balance: {portal.balance}")
        print(f"[TEST] New Retailer Balance: {retailer.balance}")
        print(f"[TEST] Generated Ledger Entry Description: {ledger_entry.description}")
        
        # Assertions
        assert portal.balance == initial_portal_balance - transfer_amount, "Portal balance mismatch!"
        assert retailer.balance == initial_retailer_balance + transfer_amount, "Retailer balance mismatch!"
        assert ledger_entry.transaction_type == "debit", "Ledger transaction type must be debit!"
        assert ledger_entry.amount == transfer_amount, "Ledger amount mismatch!"
        
        print("[SUCCESS] All test assertions passed successfully!")
        
    except Exception as e:
        print(f"[FAIL] Test encountered exception: {str(e)}")
    finally:
        # Roll back to keep the database completely clean
        db.rollback()
        print("[TEST] Database successfully rolled back to keep it clean.")
        db.close()

if __name__ == "__main__":
    run_test()
