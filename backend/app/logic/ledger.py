from datetime import datetime
from decimal import Decimal
from sqlalchemy import select, desc
from sqlalchemy.orm import Session, joinedload
from app.database.models import Ledger


def lock_portal(db: Session, bank_account):
    """Lock the bank account's Portal row (if any) before mutating its balance.

    `BankAccount` is locked with `with_for_update()` at every call site, but the related
    `Portal.balance` (mutated via the lazy-loaded `bank_account.portal` relationship)
    was never locked, so concurrent requests touching different bank accounts under the
    same portal could race on the portal's running balance. Call this right after locking
    the `BankAccount` row, before any `bank_account.portal.balance` mutation.
    """
    if bank_account and bank_account.portal_id:
        from app.database.models import Portal
        db.scalar(select(Portal).where(Portal.id == bank_account.portal_id).with_for_update())


def recalculate_balances(retailer_id, db: Session):
    """
    Recalculates all balances for a retailer's ledger from scratch to ensure consistency.
    Also robustly manages and synchronizes the "Opening Balance" ledger entry and updates linked balance snapshots.
    """
    from app.database.models import Retailer
    
    # Flush any pending changes to the database first (since autoflush is False)
    db.flush()

    # Get the retailer to access opening balances
    retailer = db.scalar(select(Retailer).where(Retailer.id == retailer_id))
    if not retailer:
        return

    # Calculate net opening balance
    net_opening_balance = (retailer.opening_to_take or Decimal("0.00")) - (retailer.opening_to_give or Decimal("0.00"))

    # Sync "Opening Balance" ledger entry, cleaning up any duplicate entries if present
    opening_ledgers = db.scalars(
        select(Ledger)
        .where(Ledger.retailer_id == retailer_id, Ledger.description == "Opening Balance")
        .order_by(Ledger.created_at, Ledger.id)
    ).all()

    if net_opening_balance == 0:
        for ol in opening_ledgers:
            db.delete(ol)
        db.flush()
    else:
        # Date the Opening Balance entry off when those figures were actually
        # set (opening_balance_set_on), not when the retailer record itself
        # was created — fall back to created_at only for legacy rows that
        # predate this column being tracked.
        opening_date = retailer.opening_balance_set_on or retailer.created_at.date()
        opening_datetime = datetime.combine(opening_date, datetime.min.time())
        if opening_ledgers:
            primary_ledger = opening_ledgers[0]
            primary_ledger.transaction_type = "credit" if net_opening_balance > 0 else "debit"
            primary_ledger.amount = abs(net_opening_balance)
            primary_ledger.created_at = opening_datetime
            # Delete any extra duplicate Opening Balance entries
            for extra_ledger in opening_ledgers[1:]:
                db.delete(extra_ledger)
        else:
            primary_ledger = Ledger(
                retailer_id=retailer_id,
                transaction_type="credit" if net_opening_balance > 0 else "debit",
                amount=abs(net_opening_balance),
                balance=net_opening_balance,
                description="Opening Balance",
                created_at=opening_datetime
            )
            db.add(primary_ledger)
        db.flush()

    # Get all ledger entries for this retailer ordered by creation time and ID for deterministic sorting
    entries = db.scalars(
        select(Ledger)
        .options(joinedload(Ledger.collection), joinedload(Ledger.deposit))
        .where(Ledger.retailer_id == retailer_id)
        .order_by(Ledger.created_at, Ledger.id)
    ).all()

    current_balance = Decimal("0.00")
    
    for entry in entries:
        # Raw signed running total, no "owe vs credit" business logic: whatever
        # amount is entered adds directly. "credit" = money flowing in from the
        # retailer (collections, virtual loads) -> adds. "debit" = money flowing
        # out to the retailer (payouts, virtual refunds) -> subtracts.
        if entry.transaction_type == "credit":
            current_balance += entry.amount
        else:
            current_balance -= entry.amount
        
        entry.balance = current_balance
        if entry.collection:
            entry.collection.balance_snapshot = current_balance
        if entry.deposit:
            entry.deposit.balance_snapshot = current_balance
    
    # Update the retailer's main balance field to match the latest ledger balance
    retailer.balance = current_balance


