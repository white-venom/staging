from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.database.models import Retailer, Ledger, Collection, BankDeposit, Attendance, Denomination
from app.dependencies import require_admin, require_staff, require_any_user

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
            joinedload(Ledger.collection).joinedload(Collection.portal),
            joinedload(Ledger.deposit).joinedload(BankDeposit.denominations),
            joinedload(Ledger.deposit).joinedload(BankDeposit.portal)
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
        remarks = tx.collection.remarks if (tx.collection and tx.collection.remarks) else ""
        reference_no = tx.deposit.reference_no if (tx.deposit and tx.deposit.reference_no) else ""
        
        # Get store name and portal name if available
        store_name = None
        portal_name = None
        if tx.collection:
            if tx.collection.store:
                store_name = tx.collection.store.store_name
            if tx.collection.portal:
                portal_name = tx.collection.portal.portal_name
        elif tx.deposit:
            if tx.deposit.portal:
                portal_name = tx.deposit.portal.portal_name

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

        tx_list.append({
            "id": tx.id,
            "date": tx.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "transaction_type": tx.transaction_type,  # 'credit', 'debit'
            "amount": float(tx.amount),
            "running_balance": float(tx.balance),
            "description": tx.description or "",
            "remarks": remarks,
            "reference_no": reference_no,
            "collection_id": str(tx.collection_id) if tx.collection_id else None,
            "deposit_id": str(tx.deposit_id) if tx.deposit_id else None,
            "store_name": store_name,
            "portal_name": portal_name,
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
    import pytz
    from datetime import datetime
    ist = pytz.timezone('Asia/Kolkata')
    today = datetime.now(ist).date()

    # 1. Today's collections sum
    collections_today = db.scalar(
        select(func.sum(Collection.total_amount))
        .where(and_(
            func.date(Collection.created_at) == today,
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
    """
    # 1. Summarize all collections made by this staff member (excluding internal staff-to-staff handovers)
    collections_denoms = db.scalars(
        select(Denomination)
        .join(Collection, Denomination.collection_id == Collection.id)
        .where(
            and_(
                Collection.staff_id == current_user.id,
                Collection.from_staff_id == None
            )
        )
    ).all()

    # 2. Summarize all deposits/handovers made by this staff member
    deposits_denoms = db.scalars(
        select(Denomination)
        .join(BankDeposit, Denomination.deposit_id == BankDeposit.id)
        .where(BankDeposit.staff_id == current_user.id)
    ).all()

    # 3. Summarize all handovers received by this staff member from other staff
    received_denoms = db.scalars(
        select(Denomination)
        .join(BankDeposit, Denomination.deposit_id == BankDeposit.id)
        .where(
            and_(
                BankDeposit.recipient_staff_id == current_user.id,
                BankDeposit.deposit_type == "staff",
                BankDeposit.status == "verified"
            )
        )
    ).all()

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

    # Calculate net pocket notes: collected + received - deposited
    pocket = {
        "note_500": max(0, collected["note_500"] + received["note_500"] - deposited["note_500"]),
        "note_200": max(0, collected["note_200"] + received["note_200"] - deposited["note_200"]),
        "note_100": max(0, collected["note_100"] + received["note_100"] - deposited["note_100"]),
        "note_50": max(0, collected["note_50"] + received["note_50"] - deposited["note_50"]),
        "note_20": max(0, collected["note_20"] + received["note_20"] - deposited["note_20"]),
        "note_10": max(0, collected["note_10"] + received["note_10"] - deposited["note_10"]),
        "coins": float(max(Decimal("0.00"), collected["coins"] + received["coins"] - deposited["coins"]))
    }

    # Calculate actual physical cash-in-hand value
    total_pocket_cash = (
        pocket["note_500"] * 500 +
        pocket["note_200"] * 200 +
        pocket["note_100"] * 100 +
        pocket["note_50"] * 50 +
        pocket["note_20"] * 20 +
        pocket["note_10"] * 10 +
        pocket["coins"]
    )

    return {
        "staff_name": current_user.name,
        "total_pocket_cash": float(total_pocket_cash),
        "note_breakdown": pocket
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

    # 1. Total Collections (In) before the selected date
    collections_before = db.scalar(
        select(func.sum(Collection.total_amount))
        .where(and_(
            Collection.staff_id == target_staff_id,
            func.date(Collection.created_at) < selected_date
        ))
    ) or Decimal("0.00")

    # 2. Total Deposits (Out) before the selected date
    deposits_before = db.scalar(
        select(func.sum(BankDeposit.amount))
        .where(and_(
            BankDeposit.staff_id == target_staff_id,
            func.date(BankDeposit.created_at) < selected_date
        ))
    ) or Decimal("0.00")

    opening_balance = collections_before - deposits_before

    # 3. Total Collections (In) today
    collections_today = db.scalar(
        select(func.sum(Collection.total_amount))
        .where(and_(
            Collection.staff_id == target_staff_id,
            func.date(Collection.created_at) == selected_date
        ))
    ) or Decimal("0.00")

    # 4. Total Deposits (Out) today
    deposits_today = db.scalar(
        select(func.sum(BankDeposit.amount))
        .where(and_(
            BankDeposit.staff_id == target_staff_id,
            func.date(BankDeposit.created_at) == selected_date
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

