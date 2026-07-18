import uuid
from datetime import datetime
from decimal import Decimal
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.database.models import BankAccount, Portal
from app.schemas.bank_account import BankAccountCreate, BankAccountResponse, BankAccountUpdate
from app.dependencies import require_admin, require_any_user

router = APIRouter(prefix="/bank-accounts", tags=["Bank Accounts"])


@router.post("", response_model=BankAccountResponse, status_code=status.HTTP_201_CREATED)
def create_bank_account(
    account_data: BankAccountCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Admin-only endpoint to register bank account targets (Blinkit, Muthoot, etc.)."""
    if account_data.opening_to_take < 0 or account_data.opening_to_give < 0:
        raise HTTPException(status_code=400, detail="Opening balances cannot be negative")

    # Create bank account
    initial_balance = Decimal(str(account_data.opening_to_take)) - Decimal(str(account_data.opening_to_give))
    db_account = BankAccount(
        portal_id=account_data.portal_id,
        bank_account_name=account_data.bank_account_name,
        bank_name=account_data.bank_name,
        bank_account_no=account_data.bank_account_no,
        ifsc_code=account_data.ifsc_code,
        show_in_online_payment=account_data.show_in_online_payment,
        opening_to_give=account_data.opening_to_give,
        opening_to_take=account_data.opening_to_take,
        balance=initial_balance
    )

    # Also update the parent group's running balance
    group = db.scalar(select(Portal).where(Portal.id == account_data.portal_id))
    if group:
        group.balance += initial_balance

    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    return db_account


@router.get("", response_model=List[BankAccountResponse])
def list_bank_accounts(
    db: Session = Depends(get_db),
    current_user=Depends(require_any_user)
):
    """Get all active stores / bank accounts with bank details."""
    from sqlalchemy.orm import joinedload
    accounts = db.scalars(select(BankAccount).options(joinedload(BankAccount.portal)).order_by(BankAccount.bank_account_name)).all()
    return accounts


@router.put("/{bank_account_id}", response_model=BankAccountResponse)
def update_bank_account(
    bank_account_id: uuid.UUID,
    account_data: BankAccountUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Admin-only endpoint to update bank account details."""
    db_account = db.scalar(select(BankAccount).where(BankAccount.id == bank_account_id))
    if not db_account:
        raise HTTPException(status_code=404, detail="Bank account not found")

    if account_data.opening_to_give is not None:
        new_give = (db_account.opening_to_give or Decimal("0.00")) + Decimal(str(account_data.opening_to_give))
        if new_give < 0:
            raise HTTPException(status_code=400, detail="To Give cannot be negative")
    if account_data.opening_to_take is not None:
        new_take = (db_account.opening_to_take or Decimal("0.00")) + Decimal(str(account_data.opening_to_take))
        if new_take < 0:
            raise HTTPException(status_code=400, detail="To Take cannot be negative")

    # Update fields safely
    for field, value in account_data.model_dump(exclude_unset=True).items():
        if field not in ["opening_to_give", "opening_to_take"]:
            setattr(db_account, field, value)

    if account_data.opening_to_give is not None:
        delta_give = Decimal(str(account_data.opening_to_give))
        db_account.opening_to_give = (db_account.opening_to_give or Decimal("0.00")) + delta_give
        db_account.balance = (db_account.balance or Decimal("0.00")) - delta_give
        if db_account.portal:
            db_account.portal.balance = (db_account.portal.balance or Decimal("0.00")) - delta_give
    if account_data.opening_to_take is not None:
        delta_take = Decimal(str(account_data.opening_to_take))
        db_account.opening_to_take = (db_account.opening_to_take or Decimal("0.00")) + delta_take
        db_account.balance = (db_account.balance or Decimal("0.00")) + delta_take
        if db_account.portal:
            db_account.portal.balance = (db_account.portal.balance or Decimal("0.00")) + delta_take

    db.commit()
    db.refresh(db_account)
    return db_account


@router.delete("/{bank_account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bank_account(
    bank_account_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Admin-only endpoint to remove a bank account."""
    account = db.scalar(select(BankAccount).where(BankAccount.id == bank_account_id))
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")

    group = account.portal
    if group:
        group.balance -= account.balance

    db.delete(account)
    db.commit()

    # If the group has no bank accounts left, recreate a Primary Account
    if group:
        db.refresh(group)
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
            db.commit()

    return None


@router.get("/{bank_account_id}/ledger")
def get_bank_account_ledger(
    bank_account_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_any_user)
):
    """Fetch chronological transaction ledger for a bank/wallet account."""
    from sqlalchemy import and_
    from sqlalchemy.orm import joinedload
    from app.database.models import BankDeposit, Collection

    account = db.scalar(
        select(BankAccount)
        .options(joinedload(BankAccount.portal))
        .where(BankAccount.id == bank_account_id)
    )
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")

    # Fetch verified bank deposits for this account (portal + virtual + portal_transfer types)
    deposits = db.scalars(
        select(BankDeposit)
        .options(
            joinedload(BankDeposit.retailer),
            joinedload(BankDeposit.denominations),
            joinedload(BankDeposit.from_bank_account).joinedload(BankAccount.portal),
            joinedload(BankDeposit.bank_account).joinedload(BankAccount.portal)
        )
        .where(
            and_(
                BankDeposit.status == "verified",
                BankDeposit.deposit_type.in_(["portal", "virtual", "portal_transfer"]),
                or_(
                    BankDeposit.bank_account_id == bank_account_id,
                    BankDeposit.from_bank_account_id == bank_account_id
                )
            )
        )
    ).all()

    # Fetch verified collections for this account
    collections = db.scalars(
        select(Collection)
        .options(joinedload(Collection.retailer), joinedload(Collection.denominations))
        .where(
            and_(
                Collection.bank_account_id == bank_account_id,
                Collection.status == "verified",
                Collection.retailer_id == None
            )
        )
    ).all()

    # Fetch all verified collections across this account's whole group (not just
    # this single bank_account_id) to load store/retailer name in memory. A deposit
    # can be edited to move it to a different account within the same group
    # after the fact — the collection that originally generated it keeps its
    # own bank_account_id, so the source lookup below has to search the whole group
    # or it silently loses the retailer/store name for moved entries.
    group_account_ids = [bank_account_id]
    if account.portal_id:
        group_account_ids = [
            a.id for a in db.scalars(select(BankAccount).where(BankAccount.portal_id == account.portal_id)).all()
        ]
    all_group_cols = db.scalars(
        select(Collection)
        .options(joinedload(Collection.retailer), joinedload(Collection.store))
        .where(
            and_(
                Collection.bank_account_id.in_(group_account_ids),
                Collection.status == "verified"
            )
        )
    ).all()

    # Group collections by (date, retailer_id) and date for fast lookup. Multiple
    # collections can share the same (account, date) with no retailer_id, so keep all
    # of them per date instead of letting one silently overwrite the rest.
    col_by_date_retailer = {}
    col_by_date = {}
    for col in sorted(all_group_cols, key=lambda c: c.created_at):
        col_date = col.collection_date
        if col.retailer_id:
            col_by_date_retailer[(col_date, col.retailer_id)] = col
        col_by_date.setdefault(col_date, []).append(col)

    def _best_date_match(col_date, deposit_amount):
        candidates = col_by_date.get(col_date) or []
        if not candidates:
            return None
        for c in candidates:
            online_amt = c.denominations.online_amount if c.denominations else None
            if online_amt is not None and Decimal(str(online_amt)) == Decimal(str(deposit_amount)):
                return c
        # No unambiguous amount match — only safe to guess when there's exactly one candidate.
        return candidates[0] if len(candidates) == 1 else None

    # Merge and sort chronologically
    tx_list = []

    for d in deposits:
        # Bank deposit into account (cash deposit or online auto-route)
        retailer_name = d.retailer.retailer_name if d.retailer else None

        # For online deposits without retailer, try to find the matching collection
        # to get store name (legacy data that didn't store retailer_id on the deposit)
        store_name = None
        fallback_remarks = d.remarks
        if d.deposit_type == "portal" and d.payment_mode == "online" and not retailer_name:
            matching_col = _best_date_match(d.deposit_date, d.amount)
            if matching_col:
                retailer_name = matching_col.retailer.retailer_name if matching_col.retailer else None
                store_name = matching_col.store.store_name if matching_col.store else None
                if not fallback_remarks:
                    fallback_remarks = matching_col.remarks
        elif d.retailer:
            # If retailer is available, look up store from matching collection
            matching_col = col_by_date_retailer.get((d.deposit_date, d.retailer_id))
            if matching_col and matching_col.store:
                store_name = matching_col.store.store_name

        tx_store_name = store_name or retailer_name

        if d.deposit_type == "portal":
            tx_type = "credit" # You Got
            amount = float(d.amount)
            if d.payment_mode == "online":
                desc_text = f"Online Payment from {tx_store_name}" if tx_store_name else "Online Payment"
            else:
                desc_text = f"Cash Deposit from {tx_store_name}" if tx_store_name else "Cash Deposit"
            if fallback_remarks:
                desc_text += f" ({fallback_remarks})"
        elif d.deposit_type == "virtual":
            if d.payment_mode == "refund":
                tx_type = "credit" # You Got
                amount = float(d.amount)
                desc_text = f"Virtual Refund from {tx_store_name}" if tx_store_name else "Virtual Refund"
            else:
                tx_type = "debit" # You Gave
                amount = float(d.amount)
                desc_text = f"Virtual Transfer to {tx_store_name}" if tx_store_name else "Virtual Transfer"
            if fallback_remarks:
                desc_text += f" ({fallback_remarks})"
        elif d.deposit_type == "portal_transfer":
            # For portal_transfer: credit if this account is destination, debit if this account is source
            if str(d.bank_account_id) == str(bank_account_id):
                # This account is the destination: it received money (credit)
                tx_type = "credit"
                src_name = d.from_bank_account.portal.name if (d.from_bank_account and d.from_bank_account.portal) else (d.from_bank_account.bank_account_name if d.from_bank_account else "Source Account")
                desc_text = f"Transfer received from {src_name}"
            else:
                # This account is the source: it sent money (debit)
                tx_type = "debit"
                dst_name = d.bank_account.portal.name if (d.bank_account and d.bank_account.portal) else (d.bank_account.bank_account_name if d.bank_account else "Destination Account")
                desc_text = f"Transfer sent to {dst_name}"
            amount = float(d.amount)
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
            "tx_date": d.deposit_date,
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
        # Collection associated with account (normally cash collection associated with account)
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

        tx_list.append({
            "id": str(c.id),
            "created_at": c.created_at,
            "tx_date": c.collection_date,
            "transaction_type": "debit", # You Gave (decreases account balance)
            "amount": float(c.total_amount),
            "description": f"Collection from {c.retailer.retailer_name if c.retailer else 'Retailer'}" + (f" ({c.remarks})" if c.remarks else ""),
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

    # Sort transactions by created_at ascending to calculate running balance
    tx_list.sort(key=lambda x: x["created_at"])

    # Calculate running balance safely handling None values
    opening_take = account.opening_to_take or Decimal("0.00")
    opening_give = account.opening_to_give or Decimal("0.00")
    running_balance = float(opening_take - opening_give)
    formatted_txs = []

    for tx in tx_list:
        if tx["transaction_type"] == "credit":
            running_balance += tx["amount"]
        else:
            running_balance -= tx["amount"]

        # Display under collection_date/deposit_date, not created_at -- row order
        # and running_balance still follow created_at (real submission order).
        display_date = datetime.combine(tx["tx_date"], tx["created_at"].time()) if tx.get("tx_date") else tx["created_at"]

        formatted_txs.append({
            "id": tx["id"],
            "date": display_date.strftime("%Y-%m-%d %H:%M:%S"),
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
        "bank_account_name": account.bank_account_name,
        "portal_name": account.portal.name if account.portal else None,
        "bank_name": account.bank_name,
        "bank_account_no": account.bank_account_no,
        "ifsc_code": account.ifsc_code,
        "outstanding_balance": float(account.balance or Decimal("0.00")),
        "statement_history": formatted_txs
    }
