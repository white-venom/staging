from decimal import Decimal
from sqlalchemy import select, desc
from sqlalchemy.orm import Session
from app.database.models import Ledger

def recalculate_balances(retailer_id, db: Session):
    """
    Recalculates all balances for a retailer's ledger from scratch to ensure consistency.
    This is called after a transaction is deleted or an amount is changed in the middle of history.
    """
    # Get all ledger entries for this retailer ordered by creation time and ID for deterministic sorting
    entries = db.scalars(
        select(Ledger)
        .where(Ledger.retailer_id == retailer_id)
        .order_by(Ledger.created_at, Ledger.id)
    ).all()

    # Get the retailer to access opening balances
    from app.database.models import Retailer
    retailer = db.scalar(select(Retailer).where(Retailer.id == retailer_id))
    if not retailer:
        return

    # Start with the net opening balance
    current_balance = (retailer.opening_to_take or Decimal("0.00")) - (retailer.opening_to_give or Decimal("0.00"))
    
    for entry in entries:
        if entry.transaction_type == "credit":
            # Collections (Credit) reduce what they owe (more negative/less positive)
            current_balance -= entry.amount
        else:
            # Deposits/Charges (Debit) increase what they owe (more positive/less negative)
            current_balance += entry.amount
        
        entry.balance = current_balance
    
    # Update the retailer's main balance field to match the latest ledger balance
    retailer.balance = current_balance

