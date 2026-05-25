from decimal import Decimal
from sqlalchemy import select, desc
from sqlalchemy.orm import Session
from app.database.models import Ledger

def recalculate_balances(retailer_id, db: Session):
    """
    Recalculates all balances for a retailer's ledger from scratch to ensure consistency.
    Also robustly manages and synchronizes the "Opening Balance" ledger entry.
    """
    from app.database.models import Retailer
    
    # Get the retailer to access opening balances
    retailer = db.scalar(select(Retailer).where(Retailer.id == retailer_id))
    if not retailer:
        return

    # Calculate net opening balance
    net_opening_balance = (retailer.opening_to_take or Decimal("0.00")) - (retailer.opening_to_give or Decimal("0.00"))

    # Sync "Opening Balance" ledger entry
    opening_ledger = db.scalar(
        select(Ledger)
        .where(Ledger.retailer_id == retailer_id, Ledger.description == "Opening Balance")
    )

    if net_opening_balance == 0:
        if opening_ledger:
            db.delete(opening_ledger)
            db.flush()
    else:
        if opening_ledger:
            opening_ledger.transaction_type = "debit" if net_opening_balance > 0 else "credit"
            opening_ledger.amount = abs(net_opening_balance)
            opening_ledger.created_at = retailer.created_at
        else:
            opening_ledger = Ledger(
                retailer_id=retailer_id,
                transaction_type="debit" if net_opening_balance > 0 else "credit",
                amount=abs(net_opening_balance),
                balance=net_opening_balance,
                description="Opening Balance",
                created_at=retailer.created_at
            )
            db.add(opening_ledger)
        db.flush()

    # Get all ledger entries for this retailer ordered by creation time and ID for deterministic sorting
    entries = db.scalars(
        select(Ledger)
        .where(Ledger.retailer_id == retailer_id)
        .order_by(Ledger.created_at, Ledger.id)
    ).all()

    current_balance = Decimal("0.00")
    
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


