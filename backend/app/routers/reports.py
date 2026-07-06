import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func, and_, desc
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.database.models import Retailer, Ledger, Collection, BankDeposit, Attendance, Denomination, Portal, User, DenominationBaseline
from app.dependencies import require_admin, require_staff, require_any_user
from app.core.timezone import ist_today, ist_day_bounds_utc

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
            joinedload(Ledger.collection).joinedload(Collection.portal).joinedload(Portal.group),
            joinedload(Ledger.deposit).joinedload(BankDeposit.denominations),
            joinedload(Ledger.deposit).joinedload(BankDeposit.portal).joinedload(Portal.group),
            joinedload(Ledger.deposit).joinedload(BankDeposit.retailer),
            joinedload(Ledger.deposit).joinedload(BankDeposit.recipient_staff)
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
        
        # Get store name and portal name if available
        store_name = None
        portal_name = None
        portal_bank_name = None
        portal_group_name = None
        if tx.collection:
            if tx.collection.store:
                store_name = tx.collection.store.store_name
            if tx.collection.portal:
                portal_name = tx.collection.portal.portal_name
                portal_bank_name = tx.collection.portal.bank_name
                if tx.collection.portal.group:
                    portal_group_name = tx.collection.portal.group.name
        elif tx.deposit:
            if tx.deposit.portal:
                portal_name = tx.deposit.portal.portal_name
                portal_bank_name = tx.deposit.portal.bank_name
                if tx.deposit.portal.group:
                    portal_group_name = tx.deposit.portal.group.name
            elif tx.deposit.deposit_type == "retailer" and tx.deposit.retailer:
                portal_name = tx.deposit.retailer.retailer_name
            elif tx.deposit.deposit_type == "staff":
                if tx.deposit.to_office:
                    portal_name = "Main Office Cashier"
                elif tx.deposit.recipient_staff:
                    portal_name = tx.deposit.recipient_staff.name
            elif tx.deposit.deposit_type == "virtual":
                if tx.deposit.portal:
                    portal_name = tx.deposit.portal.portal_name
                    portal_bank_name = tx.deposit.portal.bank_name
                    if tx.deposit.portal.group:
                        portal_group_name = tx.deposit.portal.group.name
                else:
                    portal_name = "Virtual Transfer"

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
            "portal_bank_name": portal_bank_name,
            "portal_group_name": portal_group_name,
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
    today_start_utc, today_end_utc = ist_day_bounds_utc(today)

    # 1. Today's collections sum
    collections_today = db.scalar(
        select(func.sum(Collection.total_amount))
        .where(and_(
            Collection.created_at >= today_start_utc,
            Collection.created_at < today_end_utc,
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

    received_denoms = db.scalars(
        select(Denomination)
        .join(BankDeposit, Denomination.deposit_id == BankDeposit.id)
        .where(
            and_(
                BankDeposit.recipient_staff_id == current_user.id,
                BankDeposit.deposit_type == "staff"
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

    selected_day_start_utc, selected_day_end_utc = ist_day_bounds_utc(selected_date)

    # 1. Total Collections (In) before the selected date
    collections_before = db.scalar(
        select(func.sum(Collection.total_amount))
        .where(and_(
            Collection.staff_id == target_staff_id,
            Collection.created_at < selected_day_start_utc
        ))
    ) or Decimal("0.00")

    # 2. Total Deposits (Out) before the selected date
    deposits_before = db.scalar(
        select(func.sum(BankDeposit.amount))
        .where(and_(
            BankDeposit.staff_id == target_staff_id,
            BankDeposit.created_at < selected_day_start_utc
        ))
    ) or Decimal("0.00")

    opening_balance = collections_before - deposits_before

    # 3. Total Collections (In) today
    collections_today = db.scalar(
        select(func.sum(Collection.total_amount))
        .where(and_(
            Collection.staff_id == target_staff_id,
            Collection.created_at >= selected_day_start_utc,
            Collection.created_at < selected_day_end_utc
        ))
    ) or Decimal("0.00")

    # 4. Total Deposits (Out) today
    deposits_today = db.scalar(
        select(func.sum(BankDeposit.amount))
        .where(and_(
            BankDeposit.staff_id == target_staff_id,
            BankDeposit.created_at >= selected_day_start_utc,
            BankDeposit.created_at < selected_day_end_utc
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
        .options(joinedload(Collection.retailer), joinedload(Collection.store))
        .where(
            and_(
                Collection.staff_id == staff_id,
                Collection.from_staff_id == None
            )
        )
    ).all()

    received_handovers = db.scalars(
        select(BankDeposit)
        .options(joinedload(BankDeposit.staff))
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
            joinedload(BankDeposit.portal).joinedload(Portal.group),
            joinedload(BankDeposit.retailer),
            joinedload(BankDeposit.recipient_staff)
        )
        .where(
            and_(
                BankDeposit.staff_id == staff_id,
                BankDeposit.deposit_type != "virtual"
            )
        )
    ).all()

    tx_list = []

    # Format Collections (Inflows)
    for c in collections:
        retailer_name = c.retailer.retailer_name if c.retailer else "Retailer"
        store_name = f" ({c.store.store_name})" if c.store else ""
        desc = f"Collection from {retailer_name}{store_name}"
        if c.status == "pending":
            desc = f"[Pending] {desc}"
            
        tx_list.append({
            "id": str(c.id),
            "created_at": c.created_at,
            "transaction_type": "credit", # cash in
            "amount": float(c.total_amount),
            "description": desc,
            "remarks": c.remarks or "",
            "reference_no": "",
            "status": c.status
        })

    # Format Received Handovers (Inflows)
    for d in received_handovers:
        sender_name = d.staff.name if d.staff else "Staff"
        desc = f"Handover received from {sender_name}"
        tx_list.append({
            "id": str(d.id),
            "created_at": d.created_at,
            "transaction_type": "credit", # cash in
            "amount": float(d.amount),
            "description": desc,
            "remarks": d.remarks or "",
            "reference_no": d.reference_no or "",
            "status": d.status
        })

    # Format Deposits / Handovers Made (Outflows)
    for d in deposits_made:
        if d.deposit_type == "portal":
            portal_group = d.portal.group.name if (d.portal and d.portal.group) else (d.portal.portal_name if d.portal else "Portal")
            desc = f"Deposit to {portal_group}"
        elif d.deposit_type == "retailer":
            retailer_name = d.retailer.retailer_name if d.retailer else "Retailer"
            desc = f"Deposit to Retailer: {retailer_name}"
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
            "transaction_type": "debit", # cash out
            "amount": float(d.amount),
            "description": desc,
            "remarks": d.remarks or "",
            "reference_no": d.reference_no or "",
            "status": d.status
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

        formatted_txs.append({
            "id": tx["id"],
            "date": tx["created_at"].strftime("%Y-%m-%d %H:%M:%S"),
            "transaction_type": tx["transaction_type"],
            "amount": tx["amount"],
            "running_balance": running_balance,
            "description": tx["description"],
            "remarks": tx["remarks"],
            "reference_no": tx["reference_no"],
            "status": tx["status"]
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
    current_user=Depends(require_admin)
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


