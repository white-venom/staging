import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func, and_, desc
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.database.models import Retailer, Ledger, Collection, BankDeposit, Attendance, Denomination, BankAccount, User, DenominationBaseline
from app.dependencies import require_admin, require_staff, require_any_user
from app.core.timezone import ist_today
from app.logic.feature_flags import require_feature

router = APIRouter(tags=["Reports & Public Statements"])


@router.get("/public/ledger/{token}")
def get_public_ledger(
    token: str,
    db: Session = Depends(get_db)
):
    """Secure, no-login-required public route for retailers to view their running account ledger details."""
    retailer = db.scalar(select(Retailer).where(Retailer.ledger_token == token))
    if not retailer:
        raise HTTPException(status_code=404, detail="Secure statement link is invalid or expired.")

    from sqlalchemy.orm import joinedload

    # Fetch chronological transaction ledger
    transactions = db.scalars(
        select(Ledger)
        .where(Ledger.retailer_id == retailer.id)
        .options(
            joinedload(Ledger.collection).joinedload(Collection.denominations),
            joinedload(Ledger.collection).joinedload(Collection.store),
            joinedload(Ledger.collection).joinedload(Collection.bank_account).joinedload(BankAccount.portal),
            joinedload(Ledger.collection).joinedload(Collection.staff),
            joinedload(Ledger.deposit).joinedload(BankDeposit.denominations),
            joinedload(Ledger.deposit).joinedload(BankDeposit.bank_account).joinedload(BankAccount.portal),
            joinedload(Ledger.deposit).joinedload(BankDeposit.retailer),
            joinedload(Ledger.deposit).joinedload(BankDeposit.recipient_staff),
            joinedload(Ledger.deposit).joinedload(BankDeposit.staff)
        )
        .order_by(Ledger.created_at)
    ).all()

    # Calculate latest outstanding running balance
    latest_entry = db.scalar(
        select(Ledger)
        .where(Ledger.retailer_id == retailer.id)
        .order_by(Ledger.created_at.desc())
        .limit(1)
    )
    current_balance = latest_entry.balance if latest_entry else Decimal("0.00")

    tx_list = []
    for tx in transactions:
        remarks = ""
        if tx.collection and tx.collection.remarks:
            remarks = tx.collection.remarks
        elif tx.deposit and tx.deposit.remarks:
            remarks = tx.deposit.remarks
        reference_no = tx.deposit.reference_no if (tx.deposit and tx.deposit.reference_no) else ""

        staff_name = None
        if tx.collection and tx.collection.staff:
            staff_name = tx.collection.staff.name
        elif tx.deposit and tx.deposit.staff:
            staff_name = tx.deposit.staff.name

        # Get store name and bank_account name if available
        store_name = None
        bank_account_name = None
        bank_name = None
        portal_name = None
        if tx.collection:
            if tx.collection.store:
                store_name = tx.collection.store.store_name
            if tx.collection.bank_account:
                bank_account_name = tx.collection.bank_account.bank_account_name
                bank_name = tx.collection.bank_account.bank_name
                if tx.collection.bank_account.portal:
                    portal_name = tx.collection.bank_account.portal.name
        elif tx.deposit:
            if tx.deposit.bank_account:
                bank_account_name = tx.deposit.bank_account.bank_account_name
                bank_name = tx.deposit.bank_account.bank_name
                if tx.deposit.bank_account.portal:
                    portal_name = tx.deposit.bank_account.portal.name
            elif tx.deposit.deposit_type == "retailer" and tx.deposit.retailer:
                bank_account_name = tx.deposit.retailer.retailer_name
            elif tx.deposit.deposit_type == "staff":
                if tx.deposit.to_office:
                    bank_account_name = "Main Office Cashier"
                elif tx.deposit.recipient_staff:
                    bank_account_name = tx.deposit.recipient_staff.name
            elif tx.deposit.deposit_type == "virtual":
                if tx.deposit.bank_account:
                    bank_account_name = tx.deposit.bank_account.bank_account_name
                    bank_name = tx.deposit.bank_account.bank_name
                    if tx.deposit.bank_account.portal:
                        portal_name = tx.deposit.bank_account.portal.name
                else:
                    bank_account_name = "Virtual Transfer"

        # Extract denominations if available
        denom_dict = None
        denom_obj = None
        if tx.collection and tx.collection.denominations:
            denom_obj = tx.collection.denominations
        elif tx.deposit and tx.deposit.denominations:
            denom_obj = tx.deposit.denominations
            
        if denom_obj:
            denom_dict = {
                "note_500": int(denom_obj.note_500 or 0),
                "note_200": int(denom_obj.note_200 or 0),
                "note_100": int(denom_obj.note_100 or 0),
                "note_50": int(denom_obj.note_50 or 0),
                "note_20": int(denom_obj.note_20 or 0),
                "note_10": int(denom_obj.note_10 or 0),
                "coins": float(denom_obj.coins or 0.0),
                "online_amount": float(denom_obj.online_amount or 0.0)
            }

        # Display under the day the entry claims to represent (collection_date /
        # deposit_date) rather than created_at (the real submission instant), so a
        # backdated entry shows up correctly dated to the retailer. Row order and
        # running_balance still follow created_at (recalculate_balances() computes
        # `balance` in that same order) -- only the displayed date changes.
        #
        # created_at is UTC, but the frontend's formatIST() blindly treats this
        # "date" string as UTC and adds +5:30. Naively combining the tx's own date
        # with created_at's raw UTC time-of-day breaks for entries created between
        # 00:00-05:29 IST (UTC calendar date is still "yesterday" then), landing
        # the display one day ahead. Convert to IST first, combine, then subtract
        # 5:30 to pre-cancel the frontend's own conversion.
        if tx.collection:
            created_ist = tx.created_at + timedelta(hours=5, minutes=30)
            display_date = datetime.combine(tx.collection.collection_date, created_ist.time()) - timedelta(hours=5, minutes=30)
        elif tx.deposit:
            created_ist = tx.created_at + timedelta(hours=5, minutes=30)
            display_date = datetime.combine(tx.deposit.deposit_date, created_ist.time()) - timedelta(hours=5, minutes=30)
        else:
            display_date = tx.created_at

        tx_list.append({
            "id": tx.id,
            "date": display_date.strftime("%Y-%m-%d %H:%M:%S"),
            "transaction_type": tx.transaction_type,  # 'credit', 'debit'
            "amount": float(tx.amount),
            "running_balance": float(tx.balance),
            "description": tx.description or "",
            "remarks": remarks,
            "reference_no": reference_no,
            "collection_id": str(tx.collection_id) if tx.collection_id else None,
            "deposit_id": str(tx.deposit_id) if tx.deposit_id else None,
            "store_name": store_name,
            "bank_account_name": bank_account_name,
            "bank_name": bank_name,
            "portal_name": portal_name,
            "staff_name": staff_name,
            "deposit_type": tx.deposit.deposit_type if tx.deposit else None,
            "denominations": denom_dict
        })

    return {
        "retailer_name": retailer.retailer_name,
        "address": retailer.address,
        "email": retailer.email,
        "phone": retailer.phone,
        "outstanding_balance": float(current_balance),
        "statement_history": tx_list
    }


@router.get("/admin/summary")
def get_admin_summary(
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Admin dashboard summary: metrics for Today's Collections, Active Staff, and pending queues."""
    today = ist_today()

    # 1. Today's collections sum -- bucketed by collection_date (the day the entry
    # claims to represent), not created_at (the real submission instant), so a
    # collection backdated away from today is correctly excluded even if it was
    # actually submitted today, and one dated today counts even if entered late.
    collections_today = db.scalar(
        select(func.sum(Collection.total_amount))
        .where(and_(
            Collection.collection_date == today,
            Collection.status == "verified"
        ))
    ) or Decimal("0.00")

    # 2. Checked-in active staff count
    active_staff_count = db.scalar(
        select(func.count(Attendance.id))
        .where(and_(
            Attendance.date == today,
            Attendance.status == "active"
        ))
    ) or 0

    # 3. Pending collections verification count
    pending_collections = db.scalar(
        select(func.count(Collection.id))
        .where(Collection.status == "pending")
    ) or 0

    # 4. Pending bank deposit verification count
    pending_deposits = db.scalar(
        select(func.count(BankDeposit.id))
        .where(BankDeposit.status == "pending")
    ) or 0

    return {
        "today_verified_collections": float(collections_today),
        "active_field_staff": active_staff_count,
        "pending_collections_queue": pending_collections,
        "pending_deposits_queue": pending_deposits
    }


@router.get("/staff/cash-in-hand")
def get_staff_cash_in_hand(
    db: Session = Depends(get_db),
    current_user=Depends(require_staff)
):
    """Calculates active field staff's real-time cash balance and pocket note breakdown.
    Calculated as: Total collected notes - Total deposited/handed over notes.

    Mirrors the "honest sum" walk in frontend/src/app/staff/page.tsx: each
    denomination is tracked as a signed running total and is NOT clamped to zero
    per-type. A deposit almost never uses the same note mix as the collection it
    came from (banks exchange notes, staff consolidate into rounder denominations),
    so clamping any single type to max(0, ...) silently discards real value instead
    of letting it offset a surplus in another type -- that previously let the
    displayed total drift arbitrarily far from the true net position (see the
    2026-07-18 QA pass: collecting Rs.500 as a single note and depositing that exact
    Rs.500 back out as five Rs.100 notes still showed Rs.500 "in pocket").
    Only the final total is floored at zero, matching the frontend's single
    `Math.max(0, netPortfolio - totalOnline)` clamp on the headline figure.

    If a verified DenominationBaseline exists for this staff member, start every
    running total from it and only sum transactions at/after its `as_of` instant,
    instead of replaying the staff's entire history.
    """
    baseline = db.scalar(
        select(DenominationBaseline)
        .where(DenominationBaseline.staff_id == current_user.id)
        .order_by(desc(DenominationBaseline.as_of))
        .limit(1)
    )
    cutoff = baseline.as_of if baseline else None

    # 1. Summarize all collections made by this staff member (excluding internal staff-to-staff handovers)
    collections_query = (
        select(Denomination)
        .join(Collection, Denomination.collection_id == Collection.id)
        .where(
            and_(
                Collection.staff_id == current_user.id,
                Collection.from_staff_id == None
            )
        )
    )
    if cutoff is not None:
        collections_query = collections_query.where(Collection.created_at >= cutoff)
    collections_denoms = db.scalars(collections_query).all()

    # 2. Summarize all deposits/handovers made by this staff member
    deposits_query = (
        select(Denomination)
        .join(BankDeposit, Denomination.deposit_id == BankDeposit.id)
        .where(BankDeposit.staff_id == current_user.id)
    )
    if cutoff is not None:
        deposits_query = deposits_query.where(BankDeposit.created_at >= cutoff)
    deposits_denoms = db.scalars(deposits_query).all()

    received_query = (
        select(Denomination)
        .join(BankDeposit, Denomination.deposit_id == BankDeposit.id)
        .where(
            and_(
                BankDeposit.recipient_staff_id == current_user.id,
                BankDeposit.deposit_type == "staff"
            )
        )
    )
    if cutoff is not None:
        received_query = received_query.where(BankDeposit.created_at >= cutoff)
    received_denoms = db.scalars(received_query).all()

    # Aggregate collected notes
    collected = {
        "note_500": 0, "note_200": 0, "note_100": 0, "note_50": 0, "note_20": 0, "note_10": 0, "coins": Decimal("0.00")
    }
    for d in collections_denoms:
        collected["note_500"] += d.note_500
        collected["note_200"] += d.note_200
        collected["note_100"] += d.note_100
        collected["note_50"] += d.note_50
        collected["note_20"] += d.note_20
        collected["note_10"] += d.note_10
        collected["coins"] += d.coins

    # Aggregate received notes
    received = {
        "note_500": 0, "note_200": 0, "note_100": 0, "note_50": 0, "note_20": 0, "note_10": 0, "coins": Decimal("0.00")
    }
    for r in received_denoms:
        received["note_500"] += r.note_500
        received["note_200"] += r.note_200
        received["note_100"] += r.note_100
        received["note_50"] += r.note_50
        received["note_20"] += r.note_20
        received["note_10"] += r.note_10
        received["coins"] += r.coins

    # Aggregate deposited notes
    deposited = {
        "note_500": 0, "note_200": 0, "note_100": 0, "note_50": 0, "note_20": 0, "note_10": 0, "coins": Decimal("0.00")
    }
    for d in deposits_denoms:
        deposited["note_500"] += d.note_500
        deposited["note_200"] += d.note_200
        deposited["note_100"] += d.note_100
        deposited["note_50"] += d.note_50
        deposited["note_20"] += d.note_20
        deposited["note_10"] += d.note_10
        deposited["coins"] += d.coins

    baseline_note = {
        "note_500": baseline.note_500 if baseline else 0,
        "note_200": baseline.note_200 if baseline else 0,
        "note_100": baseline.note_100 if baseline else 0,
        "note_50": baseline.note_50 if baseline else 0,
        "note_20": baseline.note_20 if baseline else 0,
        "note_10": baseline.note_10 if baseline else 0,
        "coins": Decimal(str(baseline.coins)) if baseline else Decimal("0.00"),
    }

    # Net pocket per denomination: baseline (if any) + collected + received - deposited.
    # Deliberately NOT clamped per-type -- a negative count here is real, useful
    # information ("you're short one Rs.500 note"), and clamping it away while
    # leaving an offsetting surplus in another denomination untouched is exactly
    # the bug this rewrite fixes.
    pocket = {
        "note_500": baseline_note["note_500"] + collected["note_500"] + received["note_500"] - deposited["note_500"],
        "note_200": baseline_note["note_200"] + collected["note_200"] + received["note_200"] - deposited["note_200"],
        "note_100": baseline_note["note_100"] + collected["note_100"] + received["note_100"] - deposited["note_100"],
        "note_50": baseline_note["note_50"] + collected["note_50"] + received["note_50"] - deposited["note_50"],
        "note_20": baseline_note["note_20"] + collected["note_20"] + received["note_20"] - deposited["note_20"],
        "note_10": baseline_note["note_10"] + collected["note_10"] + received["note_10"] - deposited["note_10"],
        "coins": float(baseline_note["coins"] + collected["coins"] + received["coins"] - deposited["coins"]),
    }

    # Calculate actual physical cash-in-hand value from the SIGNED (unclamped) per-type
    # values, then floor only the final total at zero -- a per-type surplus can and should
    # offset a per-type shortfall (e.g. broke a Rs.500 note into Rs.100s before depositing).
    total_pocket_cash_signed = (
        pocket["note_500"] * 500 +
        pocket["note_200"] * 200 +
        pocket["note_100"] * 100 +
        pocket["note_50"] * 50 +
        pocket["note_20"] * 20 +
        pocket["note_10"] * 10 +
        Decimal(str(pocket["coins"]))
    )
    total_pocket_cash = max(Decimal("0.00"), total_pocket_cash_signed)

    return {
        "staff_name": current_user.name,
        "total_pocket_cash": float(total_pocket_cash),
        "note_breakdown": pocket,
        "baseline_as_of": baseline.as_of.isoformat() if baseline else None,
    }


@router.get("/staff/daily-summary")
def get_staff_daily_summary(
    selected_date: date,
    staff_id: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_any_user)
):
    """Calculates a staff member's opening balance, daily total In, daily total Out, and closing balance for a specific date."""
    import uuid
    from typing import Optional

    if current_user.role != "admin":
        target_staff_id = current_user.id
    else:
        target_staff_id = uuid.UUID(staff_id) if staff_id else current_user.id

    # Bucketed by collection_date/deposit_date (the day the entry claims to
    # represent) rather than created_at (the real submission instant). Both
    # columns are already plain IST calendar dates (see submit_collection /
    # submit_deposit, which default them via ist_today()), so they compare
    # directly against `selected_date` with no further timezone conversion --
    # this also means a backdated entry now correctly lands in the opening
    # balance / day bucket it was backdated to, instead of always being
    # attributed to the day it was actually keyed in.

    # 1. Total Collections (In) before the selected date
    collections_before = db.scalar(
        select(func.sum(Collection.total_amount))
        .where(and_(
            Collection.staff_id == target_staff_id,
            Collection.collection_date < selected_date
        ))
    ) or Decimal("0.00")

    # 2. Total Deposits (Out) before the selected date
    deposits_before = db.scalar(
        select(func.sum(BankDeposit.amount))
        .where(and_(
            BankDeposit.staff_id == target_staff_id,
            BankDeposit.deposit_date < selected_date
        ))
    ) or Decimal("0.00")

    opening_balance = collections_before - deposits_before

    # 3. Total Collections (In) today
    collections_today = db.scalar(
        select(func.sum(Collection.total_amount))
        .where(and_(
            Collection.staff_id == target_staff_id,
            Collection.collection_date == selected_date
        ))
    ) or Decimal("0.00")

    # 4. Total Deposits (Out) today
    deposits_today = db.scalar(
        select(func.sum(BankDeposit.amount))
        .where(and_(
            BankDeposit.staff_id == target_staff_id,
            BankDeposit.deposit_date == selected_date
        ))
    ) or Decimal("0.00")

    closing_balance = opening_balance + collections_today - deposits_today

    return {
        "staff_id": str(target_staff_id),
        "date": selected_date.isoformat(),
        "opening_balance": float(opening_balance),
        "total_in": float(collections_today),
        "total_out": float(deposits_today),
        "closing_balance": float(closing_balance)
    }


@router.get("/staff/{staff_id}/ledger")
def get_staff_ledger(
    staff_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_any_user)
):
    """Retrieve chronological cash transaction ledger for a staff member."""
    from sqlalchemy.orm import joinedload
    from app.database.models import User, Collection, BankDeposit

    # Security check: only admins or the staff member themselves can view this ledger
    if current_user.role != "admin" and current_user.id != staff_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this staff ledger")

    staff = db.scalar(select(User).where(User.id == staff_id))
    if not staff:
        raise HTTPException(status_code=404, detail="Staff user not found")

    # Fetch cash collections made by this staff (excluding handovers from staff)
    collections = db.scalars(
        select(Collection)
        .options(joinedload(Collection.retailer), joinedload(Collection.store), joinedload(Collection.denominations))
        .where(
            and_(
                Collection.staff_id == staff_id,
                Collection.from_staff_id == None
            )
        )
    ).all()

    received_handovers = db.scalars(
        select(BankDeposit)
        .options(joinedload(BankDeposit.staff), joinedload(BankDeposit.denominations))
        .where(
            and_(
                BankDeposit.recipient_staff_id == staff_id,
                BankDeposit.deposit_type == "staff"
            )
        )
    ).all()

    # Fetch deposits and handovers made by this staff (exclude virtual deposits)
    deposits_made = db.scalars(
        select(BankDeposit)
        .options(
            joinedload(BankDeposit.bank_account).joinedload(BankAccount.portal),
            joinedload(BankDeposit.retailer),
            joinedload(BankDeposit.recipient_staff),
            joinedload(BankDeposit.denominations)
        )
        .where(
            and_(
                BankDeposit.staff_id == staff_id,
                BankDeposit.deposit_type != "virtual"
            )
        )
    ).all()

    def _denom_dict(denom):
        if not denom:
            return None
        return {
            "note_500": int(denom.note_500 or 0),
            "note_200": int(denom.note_200 or 0),
            "note_100": int(denom.note_100 or 0),
            "note_50": int(denom.note_50 or 0),
            "note_20": int(denom.note_20 or 0),
            "note_10": int(denom.note_10 or 0),
            "coins": float(denom.coins or 0),
            "online_amount": float(denom.online_amount or 0),
        }

    tx_list = []

    # Format Collections (Inflows)
    for c in collections:
        retailer_name = c.retailer.retailer_name if c.retailer else ("Office" if c.from_office else "Retailer")
        store_name = c.store.store_name if c.store else None
        desc = f"Collection from {retailer_name}"
        if store_name:
            desc += f" ({store_name})"
        if c.status == "pending":
            desc = f"[Pending] {desc}"

        tx_list.append({
            "id": str(c.id),
            "created_at": c.created_at,
            "tx_date": c.collection_date,
            "transaction_type": "credit", # cash in
            "amount": float(c.total_amount),
            "description": desc,
            "remarks": c.remarks or "",
            "reference_no": "",
            "status": c.status,
            "retailer_name": retailer_name,
            "store_name": store_name,
            "bank_account_name": None,
            "portal_name": None,
            "bank_name": None,
            "deposit_type": None,
            "denominations": _denom_dict(c.denominations),
        })

    # Format Received Handovers (Inflows)
    for d in received_handovers:
        sender_name = d.staff.name if d.staff else "Staff"
        desc = f"Handover received from {sender_name}"
        tx_list.append({
            "id": str(d.id),
            "created_at": d.created_at,
            "tx_date": d.deposit_date,
            "transaction_type": "credit", # cash in
            "amount": float(d.amount),
            "description": desc,
            "remarks": d.remarks or "",
            "reference_no": d.reference_no or "",
            "status": d.status,
            "retailer_name": f"Staff: {sender_name}",
            "store_name": None,
            "bank_account_name": None,
            "portal_name": None,
            "bank_name": None,
            "deposit_type": "staff",
            "denominations": _denom_dict(d.denominations),
        })

    # Format Deposits / Handovers Made (Outflows)
    for d in deposits_made:
        bank_account_name = d.bank_account.bank_account_name if d.bank_account else None
        portal_name = d.bank_account.portal.name if (d.bank_account and d.bank_account.portal) else None
        bank_name = d.bank_account.bank_name if d.bank_account else None
        retailer_name = d.retailer.retailer_name if d.retailer else None

        if d.deposit_type == "portal":
            desc = f"Deposit to {portal_name or bank_account_name or 'Bank Account'}"
        elif d.deposit_type == "retailer":
            desc = f"Deposit to Retailer: {retailer_name or 'Retailer'}"
        elif d.deposit_type == "staff":
            if d.to_office:
                desc = "Handover to Main Office"
            else:
                recipient_name = d.recipient_staff.name if d.recipient_staff else "Staff"
                desc = f"Handover to Staff: {recipient_name}"
        else:
            continue

        if d.status == "pending":
            desc = f"[Pending] {desc}"

        tx_list.append({
            "id": str(d.id),
            "created_at": d.created_at,
            "tx_date": d.deposit_date,
            "transaction_type": "debit", # cash out
            "amount": float(d.amount),
            "description": desc,
            "remarks": d.remarks or "",
            "reference_no": d.reference_no or "",
            "status": d.status,
            "retailer_name": retailer_name,
            "store_name": None,
            "bank_account_name": bank_account_name,
            "portal_name": portal_name,
            "bank_name": bank_name,
            "deposit_type": d.deposit_type,
            "denominations": _denom_dict(d.denominations),
        })

    # Sort transactions chronologically
    tx_list.sort(key=lambda x: x["created_at"])

    # Calculate running balance
    running_balance = 0.0
    formatted_txs = []

    for tx in tx_list:
        if tx["transaction_type"] == "credit":
            running_balance += tx["amount"]
        else:
            running_balance -= tx["amount"]

        # Display under collection_date/deposit_date (the day the entry claims to
        # represent), not created_at -- row order and running_balance still follow
        # created_at (the real chronological submission order).
        #
        # created_at is UTC, but the frontend's formatIST() blindly treats this
        # "date" string as UTC and adds +5:30. Naively combining tx_date with
        # created_at's raw UTC time-of-day breaks for entries created between
        # 00:00-05:29 IST (UTC calendar date is still "yesterday" then), landing
        # the display one day ahead of tx_date. Convert to IST first, combine,
        # then subtract 5:30 to pre-cancel the frontend's own conversion.
        if tx.get("tx_date"):
            created_ist = tx["created_at"] + timedelta(hours=5, minutes=30)
            combined_ist = datetime.combine(tx["tx_date"], created_ist.time())
            display_date = combined_ist - timedelta(hours=5, minutes=30)
        else:
            display_date = tx["created_at"]

        formatted_txs.append({
            "id": tx["id"],
            "date": display_date.strftime("%Y-%m-%d %H:%M:%S"),
            "transaction_type": tx["transaction_type"],
            "amount": tx["amount"],
            "running_balance": running_balance,
            "description": tx["description"],
            "remarks": tx["remarks"],
            "reference_no": tx["reference_no"],
            "status": tx["status"],
            "retailer_name": tx["retailer_name"],
            "store_name": tx["store_name"],
            "bank_account_name": tx["bank_account_name"],
            "portal_name": tx["portal_name"],
            "bank_name": tx["bank_name"],
            "deposit_type": tx["deposit_type"],
            "denominations": tx["denominations"],
        })

    return {
        "staff_name": staff.name,
        "phone": staff.phone,
        "role": staff.role,
        "outstanding_balance": running_balance,
        "statement_history": formatted_txs
    }


class DenominationBaselineIn(BaseModel):
    staff_id: uuid.UUID
    note_500: int = 0
    note_200: int = 0
    note_100: int = 0
    note_50: int = 0
    note_20: int = 0
    note_10: int = 0
    coins: Decimal = Decimal("0.00")
    as_of: Optional[datetime] = None  # defaults to now (UTC) if omitted


def _serialize_baseline(baseline: "DenominationBaseline") -> dict:
    return {
        "id": str(baseline.id),
        "staff_id": str(baseline.staff_id),
        "note_500": baseline.note_500,
        "note_200": baseline.note_200,
        "note_100": baseline.note_100,
        "note_50": baseline.note_50,
        "note_20": baseline.note_20,
        "note_10": baseline.note_10,
        "coins": float(baseline.coins),
        "as_of": baseline.as_of.isoformat(),
        "set_by": str(baseline.set_by) if baseline.set_by else None,
        "created_at": baseline.created_at.isoformat(),
    }


@router.post("/staff/denomination-baseline")
def set_denomination_baseline(
    payload: DenominationBaselineIn,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
    _feature=Depends(require_feature("denomination_baseline"))
):
    """Records a verified physical cash count for a staff member as of a point in
    time. Pocket denomination calculations use the most recent baseline (plus
    transactions after it) instead of replaying the staff's entire history."""
    staff = db.get(User, payload.staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found.")

    baseline = DenominationBaseline(
        staff_id=payload.staff_id,
        note_500=payload.note_500,
        note_200=payload.note_200,
        note_100=payload.note_100,
        note_50=payload.note_50,
        note_20=payload.note_20,
        note_10=payload.note_10,
        coins=payload.coins,
        as_of=payload.as_of or datetime.utcnow(),
        set_by=current_user.id,
    )
    db.add(baseline)
    db.commit()
    db.refresh(baseline)

    return _serialize_baseline(baseline)


@router.get("/staff/denomination-baseline")
def get_denomination_baseline(
    staff_id: Optional[uuid.UUID] = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_any_user)
):
    """Returns the most recent verified cash-count baseline for a staff member,
    or null if none has been set yet (in which case callers should fall back to
    the full-history reconstruction)."""
    target_id = staff_id if (current_user.role == "admin" and staff_id) else current_user.id

    baseline = db.scalar(
        select(DenominationBaseline)
        .where(DenominationBaseline.staff_id == target_id)
        .order_by(desc(DenominationBaseline.as_of))
        .limit(1)
    )
    if not baseline:
        return None

    return _serialize_baseline(baseline)


@router.get("/staff/denomination-baselines")
def list_denomination_baselines(
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Returns the most recent verified baseline for every staff member that has
    one, keyed by staff_id, for the admin overview dashboards."""
    rows = db.execute(
        select(DenominationBaseline)
        .order_by(DenominationBaseline.staff_id, desc(DenominationBaseline.as_of))
    ).scalars().all()

    latest_by_staff: dict = {}
    for row in rows:
        key = str(row.staff_id)
        if key not in latest_by_staff:
            latest_by_staff[key] = _serialize_baseline(row)

    return latest_by_staff


