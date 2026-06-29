from decimal import Decimal
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database.models import Ledger, Retailer
from app.logic.ledger import recalculate_balances

def fix_historical_ledger_dates(db: Session):
    """
    Finds all ledger entries where the date of created_at does not match
    the transaction date of the associated Collection or BankDeposit,
    updates them to match, and triggers balance recalculation.
    """
    try:
        # Fetch all ledger entries
        ledgers = db.scalars(select(Ledger)).all()
        updated_retailers = set()
        
        for ledger in ledgers:
            expected_date = None
            if ledger.collection:
                expected_date = ledger.collection.collection_date
            elif ledger.deposit:
                expected_date = ledger.deposit.deposit_date
                
            if expected_date and ledger.created_at.date() != expected_date:
                old_dt = ledger.created_at
                new_dt = datetime.combine(expected_date, old_dt.time())
                ledger.created_at = new_dt
                updated_retailers.add(ledger.retailer_id)
                print(f"[INFO] Fixed Ledger {ledger.id}: Changed created_at from {old_dt} to {new_dt}")
                
        # Recalculate balances for any retailers that had updates
        if updated_retailers:
            for r_id in updated_retailers:
                print(f"[INFO] Recalculating balances for Retailer {r_id}...")
                # Lock the retailer row before recalculating so this never races with a
                # concurrent request mutating the same retailer's ledger.
                db.scalar(select(Retailer).where(Retailer.id == r_id).with_for_update())
                recalculate_balances(r_id, db)
            db.commit()
            print(f"[INFO] Successfully fixed and recalculated ledger balances for {len(updated_retailers)} retailer(s).")
        else:
            print("[INFO] Ledger dates are already fully synchronized. No updates needed.")
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Error fixing historical ledger dates: {e}")
        raise
