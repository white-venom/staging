import uuid
from decimal import Decimal
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.database.models import BankAccount, Portal, PortalAdjustment
from app.schemas.portal import (
    PortalCreate,
    PortalResponse,
    PortalUpdate
)
from app.schemas.bank_account import BankAccountResponse
from app.dependencies import require_admin, require_any_user

router = APIRouter(prefix="/portals", tags=["Portals & Stores"])


# --- Portals ---

@router.post("", response_model=PortalResponse, status_code=status.HTTP_201_CREATED)
def create_portal(
    group_data: PortalCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Admin-only endpoint to register a Portal (e.g., RevaPay)."""
    if group_data.opening_to_take < 0 or group_data.opening_to_give < 0:
        raise HTTPException(status_code=400, detail="Opening balances cannot be negative")

    initial_balance = Decimal(str(group_data.opening_to_take)) - Decimal(str(group_data.opening_to_give))

    db_group = Portal(
        name=group_data.name,
        opening_to_give=group_data.opening_to_give,
        opening_to_take=group_data.opening_to_take,
        balance=initial_balance
    )
    db.add(db_group)
    db.commit()
    db.refresh(db_group)

    # Automatically create a default Primary Account for the new Portal
    db_account = BankAccount(
        portal_id=db_group.id,
        bank_account_name="Primary Account",
        opening_to_give=db_group.opening_to_give,
        opening_to_take=db_group.opening_to_take,
        balance=db_group.balance,
        show_in_online_payment=group_data.show_in_online_payment
    )
    db.add(db_account)
    db.commit()
    db.refresh(db_group)
    return db_group


@router.get("", response_model=List[PortalResponse])
def list_portals(
    db: Session = Depends(get_db),
    current_user=Depends(require_any_user)
):
    """Get all Portals."""
    from sqlalchemy.orm import joinedload
    groups = db.scalars(select(Portal).options(joinedload(Portal.bank_accounts)).order_by(Portal.name)).unique().all()

    # Auto-heal: Ensure every group has at least one bank account (e.g. Primary Account)
    healed = False
    for group in groups:
        if len(group.bank_accounts) == 0:
            primary_account = BankAccount(
                portal_id=group.id,
                bank_account_name="Primary Account",
                opening_to_give=Decimal("0.00"),
                opening_to_take=Decimal("0.00"),
                balance=group.balance,
                show_in_online_payment=True
            )
            db.add(primary_account)
            healed = True

    if healed:
        db.commit()
        # Re-fetch healed groups
        groups = db.scalars(select(Portal).options(joinedload(Portal.bank_accounts)).order_by(Portal.name)).unique().all()

    return groups


@router.put("/{portal_id}", response_model=PortalResponse)
def update_portal(
    portal_id: uuid.UUID,
    group_data: PortalUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Admin-only endpoint to update a Portal."""
    db_group = db.scalar(select(Portal).where(Portal.id == portal_id))
    if not db_group:
        raise HTTPException(status_code=404, detail="Portal not found")

    if group_data.opening_to_give is not None:
        new_give = (db_group.opening_to_give or Decimal("0.00")) + Decimal(str(group_data.opening_to_give))
        if new_give < 0:
            raise HTTPException(status_code=400, detail="To Give cannot be negative")
    if group_data.opening_to_take is not None:
        new_take = (db_group.opening_to_take or Decimal("0.00")) + Decimal(str(group_data.opening_to_take))
        if new_take < 0:
            raise HTTPException(status_code=400, detail="To Take cannot be negative")

    db_group.name = group_data.name
    if group_data.opening_to_give is not None:
        delta_give = Decimal(str(group_data.opening_to_give))
        db_group.opening_to_give = (db_group.opening_to_give or Decimal("0.00")) + delta_give
        db_group.balance = (db_group.balance or Decimal("0.00")) - delta_give
        db.add(PortalAdjustment(
            portal_id=db_group.id,
            transaction_type="debit",
            amount=delta_give,
            description=f"Manually Added by {current_user.name}",
            created_by=current_user.id
        ))
    if group_data.opening_to_take is not None:
        delta_take = Decimal(str(group_data.opening_to_take))
        db_group.opening_to_take = (db_group.opening_to_take or Decimal("0.00")) + delta_take
        db_group.balance = (db_group.balance or Decimal("0.00")) + delta_take
        db.add(PortalAdjustment(
            portal_id=db_group.id,
            transaction_type="credit",
            amount=delta_take,
            description=f"Manually Added by {current_user.name}",
            created_by=current_user.id
        ))
    if group_data.show_in_online_payment is not None:
        for account in db_group.bank_accounts:
            account.show_in_online_payment = group_data.show_in_online_payment

    db.commit()
    db.refresh(db_group)
    return db_group


@router.delete("/{portal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_portal(
    portal_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Admin-only endpoint to remove a portal and all its accounts."""
    db_group = db.scalar(select(Portal).where(Portal.id == portal_id))
    if not db_group:
        raise HTTPException(status_code=404, detail="Portal not found")

    try:
        db.delete(db_group)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error deleting portal: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred while deleting the portal."
        )
    return None


@router.get("/{portal_id}/accounts", response_model=List[BankAccountResponse])
def list_portal_accounts(
    portal_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_any_user)
):
    """Get all accounts under a specific Portal."""
    accounts = db.scalars(select(BankAccount).where(BankAccount.portal_id == portal_id).order_by(BankAccount.bank_account_name)).all()
    return accounts


@router.get("/{portal_id}/ledger")
def get_portal_ledger(
    portal_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_any_user)
):
    """Fetch chronological consolidated transaction ledger for a portal (e.g. PAYNEARBY)."""
    from sqlalchemy import and_, select
    from sqlalchemy.orm import joinedload
    from app.database.models import BankDeposit, Collection

    group = db.scalar(select(Portal).where(Portal.id == portal_id))
    if not group:
        raise HTTPException(status_code=404, detail="Portal group not found")

    # Manual "Adjust Balance" edits, shown as their own line items in the ledger
    adjustments = db.scalars(
        select(PortalAdjustment).where(PortalAdjustment.portal_id == portal_id)
    ).all()
    adjustment_txs = [
        {
            "id": str(a.id),
            "created_at": a.created_at,
            "transaction_type": a.transaction_type,
            "amount": float(a.amount),
            "description": a.description or "Manually Added",
            "collection_id": None,
            "deposit_id": None,
            "remarks": None,
            "reference_no": None,
            "deposit_type": None,
            "payment_mode": None,
            "recipient_staff_id": None,
            "to_office": None,
            "retailer_id": None,
            "store_id": None,
            "store_name": None,
            "bank_account_id": None,
            "denominations": None
        }
        for a in adjustments
    ]

    # Get all bank account IDs in this group
    accounts = db.scalars(select(BankAccount).where(BankAccount.portal_id == portal_id)).all()
    account_ids = [a.id for a in accounts]

    # Fetch verified deposits for these accounts (empty account_ids naturally yields no rows)
    deposits = db.scalars(
        select(BankDeposit)
        .options(joinedload(BankDeposit.retailer), joinedload(BankDeposit.bank_account), joinedload(BankDeposit.denominations))
        .where(
            and_(
                BankDeposit.bank_account_id.in_(account_ids),
                BankDeposit.status == "verified"
            )
        )
    ).all()

    # Fetch verified direct collections for these accounts (where retailer_id is None)
    collections = db.scalars(
        select(Collection)
        .options(joinedload(Collection.retailer), joinedload(Collection.bank_account), joinedload(Collection.denominations), joinedload(Collection.store))
        .where(
            and_(
                Collection.bank_account_id.in_(account_ids),
                Collection.status == "verified",
                Collection.retailer_id == None
            )
        )
    ).all()

    # Fetch all verified collections for these accounts
    all_group_cols = db.scalars(
        select(Collection)
        .options(joinedload(Collection.retailer), joinedload(Collection.store))
        .where(
            and_(
                Collection.bank_account_id.in_(account_ids),
                Collection.status == "verified"
            )
        )
    ).all()

    # Group collections by (account_id, date, retailer_id) and (account_id, date). Multiple
    # collections can share the same (account, date) with no retailer_id, so keep all of
    # them per key instead of letting one silently overwrite the rest.
    col_by_account_date_retailer = {}
    # Keyed by date only (not account_id): if a deposit is later edited to move
    # it to a different account within the same group, this fallback match
    # must still find the collection that originally generated it — the
    # collection's own account_id doesn't change just because the deposit's did.
    col_by_account_date = {}
    for col in sorted(all_group_cols, key=lambda c: c.created_at):
        k_triple = (col.collection_date, col.retailer_id)
        k_date = col.collection_date
        if col.retailer_id:
            col_by_account_date_retailer[k_triple] = col
        col_by_account_date.setdefault(k_date, []).append(col)

    def _best_account_date_match(col_date, deposit_amount):
        candidates = col_by_account_date.get(col_date) or []
        if not candidates:
            return None
        for c in candidates:
            online_amt = c.denominations.online_amount if c.denominations else None
            if online_amt is not None and Decimal(str(online_amt)) == Decimal(str(deposit_amount)):
                return c
        # No unambiguous amount match — only safe to guess when there's exactly one candidate.
        return candidates[0] if len(candidates) == 1 else None

    tx_list = []

    for d in deposits:
        retailer_name = d.retailer.retailer_name if d.retailer else None
        a_name = d.bank_account.bank_account_name if d.bank_account else "Account"

        # For online deposits without retailer, try to find the matching collection
        # to get store name (legacy data that didn't store retailer_id on the deposit)
        store_name = None
        fallback_remarks = d.remarks
        if d.deposit_type == "portal" and d.payment_mode == "online" and not retailer_name:
            matching_col = _best_account_date_match(d.deposit_date, d.amount)
            if matching_col:
                retailer_name = matching_col.retailer.retailer_name if matching_col.retailer else None
                store_name = matching_col.store.store_name if matching_col.store else None
                if not fallback_remarks:
                    fallback_remarks = matching_col.remarks
        elif d.retailer:
            # If retailer is available, look up store from matching collection
            matching_col = col_by_account_date_retailer.get((d.deposit_date, d.retailer_id))
            if matching_col and matching_col.store:
                store_name = matching_col.store.store_name

        tx_store_name = store_name or retailer_name

        prefix = f"[{a_name}] " if a_name.lower().strip() != "primary account" else ""
        if d.deposit_type == "portal":
            tx_type = "credit"
            amount = float(d.amount)
            if d.payment_mode == "online":
                desc_text = f"{prefix}Online Payment from {tx_store_name}" if tx_store_name else f"{prefix}Online Payment"
            else:
                desc_text = f"{prefix}Cash Deposit from {tx_store_name}" if tx_store_name else f"{prefix}Cash Deposit"
            if fallback_remarks:
                desc_text += f" ({fallback_remarks})"
        elif d.deposit_type == "virtual":
            if d.payment_mode == "refund":
                tx_type = "credit"
                amount = float(d.amount)
                desc_text = f"Virtual Refund from {tx_store_name}" if tx_store_name else "Virtual Refund"
            else:
                tx_type = "debit"
                amount = float(d.amount)
                desc_text = f"Virtual Transfer to {tx_store_name}" if tx_store_name else "Virtual Transfer"
            if fallback_remarks:
                desc_text += f" ({fallback_remarks})"
        else:
            continue

        denom_dict = None
        if d.denominations:
            denom_dict = {
                "note_500": int(d.denominations.note_500 or 0),
                "note_200": int(d.denominations.note_200 or 0),
                "note_100": int(d.denominations.note_100 or 0),
                "note_50": int(d.denominations.note_50 or 0),
                "note_20": int(d.denominations.note_20 or 0),
                "note_10": int(d.denominations.note_10 or 0),
                "coins": float(d.denominations.coins or 0.0),
                "online_amount": float(d.denominations.online_amount or 0.0)
            }

        tx_list.append({
            "id": str(d.id),
            "created_at": d.created_at,
            "transaction_type": tx_type,
            "amount": amount,
            "description": desc_text,
            "collection_id": None,
            "deposit_id": str(d.id),
            "remarks": fallback_remarks,
            "reference_no": d.reference_no,
            "deposit_type": d.deposit_type,
            "payment_mode": d.payment_mode,
            "recipient_staff_id": str(d.recipient_staff_id) if d.recipient_staff_id else None,
            "to_office": d.to_office,
            "retailer_id": str(d.retailer_id) if d.retailer_id else None,
            "store_id": None,
            "store_name": tx_store_name,
            "bank_account_id": str(d.bank_account_id) if d.bank_account_id else None,
            "denominations": denom_dict
        })

    for c in collections:
        a_name = c.bank_account.bank_account_name if c.bank_account else "Account"
        denom_dict = None
        if c.denominations:
            denom_dict = {
                "note_500": int(c.denominations.note_500 or 0),
                "note_200": int(c.denominations.note_200 or 0),
                "note_100": int(c.denominations.note_100 or 0),
                "note_50": int(c.denominations.note_50 or 0),
                "note_20": int(c.denominations.note_20 or 0),
                "note_10": int(c.denominations.note_10 or 0),
                "coins": float(c.denominations.coins or 0.0),
                "online_amount": float(c.denominations.online_amount or 0.0)
            }
        prefix = f"[{a_name}] " if a_name.lower().strip() != "primary account" else ""
        tx_list.append({
            "id": str(c.id),
            "created_at": c.created_at,
            "transaction_type": "debit",
            "amount": float(c.total_amount),
            "description": f"{prefix}Collection from {c.retailer.retailer_name if c.retailer else 'Retailer'}" + (f" ({c.remarks})" if c.remarks else ""),
            "collection_id": str(c.id),
            "deposit_id": None,
            "remarks": c.remarks,
            "reference_no": None,
            "deposit_type": None,
            "payment_mode": "cash",
            "recipient_staff_id": None,
            "to_office": c.from_office,
            "retailer_id": str(c.retailer_id) if c.retailer_id else None,
            "store_id": str(c.store_id) if c.store_id else None,
            "store_name": c.store.store_name if (c.store and c.store.store_name) else (c.retailer.retailer_name if c.retailer else None),
            "bank_account_id": str(c.bank_account_id) if c.bank_account_id else None,
            "denominations": denom_dict
        })

    tx_list.extend(adjustment_txs)
    tx_list.sort(key=lambda x: x["created_at"])

    # opening_to_take/opening_to_give already include every manual adjustment ever made
    # (each "Adjust Balance" edit increments them). Since those same adjustments are now
    # also walked as individual line items below, back them out of the starting point here
    # so they aren't counted twice.
    adjustment_net = sum(
        (a["amount"] if a["transaction_type"] == "credit" else -a["amount"])
        for a in adjustment_txs
    )
    opening_take = group.opening_to_take or Decimal("0.00")
    opening_give = group.opening_to_give or Decimal("0.00")
    running_balance = float(opening_take - opening_give) - adjustment_net
    formatted_txs = []

    for tx in tx_list:
        if tx["transaction_type"] == "credit":
            running_balance += tx["amount"]
        else:
            running_balance -= tx["amount"]

        formatted_txs.append({
            "id": tx["id"],
            "date": tx["created_at"].strftime("%Y-%m-%d %H:%M:%S"),
            "transaction_type": tx["transaction_type"],
            "amount": tx["amount"],
            "running_balance": running_balance,
            "description": tx["description"],
            "collection_id": tx["collection_id"],
            "deposit_id": tx["deposit_id"],
            "remarks": tx["remarks"],
            "reference_no": tx["reference_no"],
            "deposit_type": tx["deposit_type"],
            "payment_mode": tx["payment_mode"],
            "recipient_staff_id": tx["recipient_staff_id"],
            "to_office": tx["to_office"],
            "retailer_id": tx["retailer_id"],
            "store_id": tx["store_id"],
            "store_name": tx.get("store_name"),
            "bank_account_id": tx["bank_account_id"],
            "denominations": tx["denominations"]
        })

    return {
        "portal_name": group.name,
        "outstanding_balance": float(group.balance or Decimal("0.00")),
        "statement_history": formatted_txs
    }
