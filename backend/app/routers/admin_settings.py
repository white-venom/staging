import uuid
from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update, desc
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel, Field

from app.database.db import get_db
from app.database.models import BusinessSettings, Attendance, Portal, Retailer, Ledger, User, BankDeposit
from datetime import date
from app.dependencies import require_admin, require_any_user

router = APIRouter(prefix="/admin-settings", tags=["Admin Control Panel"])

class SettingsUpdate(BaseModel):
    late_threshold: str
    late_penalty: float
    auto_checkout_time: str
    edit_window_minutes: int = 5   # -1 = permanent
    delete_window_minutes: int = 5 # -1 = permanent
    opening_cash_in_hand: float = 0.0

class PenaltyApproval(BaseModel):
    attendance_id: uuid.UUID
    approve: bool

class VirtualTransferRequest(BaseModel):
    portal_id: uuid.UUID
    retailer_id: Optional[uuid.UUID] = None
    staff_id: Optional[uuid.UUID] = None
    amount: Decimal = Field(..., gt=0)
    remarks: Optional[str] = None
    direction: str = "load"  # "load" (Portal -> Retailer) or "refund" (Retailer -> Portal)
    transfer_date: Optional[date] = None

@router.get("/business", response_model=dict)
def get_business_settings(db: Session = Depends(get_db), current_user=Depends(require_any_user)):
    settings = db.scalar(select(BusinessSettings).where(BusinessSettings.id == 1))
    if not settings:
        return {
            "late_threshold": "10:00",
            "late_penalty": 100.0,
            "auto_checkout_time": "20:00",
            "edit_window_minutes": 5,
            "delete_window_minutes": 5,
            "opening_cash_in_hand": 0.0
        }
    return {
        "late_threshold": settings.late_threshold,
        "late_penalty": settings.late_penalty,
        "auto_checkout_time": getattr(settings, 'auto_checkout_time', "20:00"),
        "edit_window_minutes": getattr(settings, 'edit_window_minutes', 5),
        "delete_window_minutes": getattr(settings, 'delete_window_minutes', 5),
        "opening_cash_in_hand": getattr(settings, 'opening_cash_in_hand', 0.0),
    }

@router.put("/business")
def update_business_settings(data: SettingsUpdate, db: Session = Depends(get_db), current_user=Depends(require_admin)):
    settings = db.scalar(select(BusinessSettings).where(BusinessSettings.id == 1))
    if not settings:
        settings = BusinessSettings(
            id=1,
            late_threshold=data.late_threshold,
            late_penalty=data.late_penalty,
            auto_checkout_time=data.auto_checkout_time,
            edit_window_minutes=data.edit_window_minutes,
            delete_window_minutes=data.delete_window_minutes,
            opening_cash_in_hand=data.opening_cash_in_hand,
        )
        db.add(settings)
    else:
        settings.late_threshold = data.late_threshold
        settings.late_penalty = data.late_penalty
        settings.auto_checkout_time = data.auto_checkout_time
        settings.edit_window_minutes = data.edit_window_minutes
        settings.delete_window_minutes = data.delete_window_minutes
        settings.opening_cash_in_hand = data.opening_cash_in_hand
    db.commit()
    return {"message": "Settings updated successfully"}


@router.get("/pending-penalties")
def list_pending_penalties(db: Session = Depends(get_db), current_user=Depends(require_admin)):
    """List all attendance records that are late but penalty is not yet approved."""
    from app.routers.attendance import check_and_trigger_auto_checkout
    check_and_trigger_auto_checkout(db)
    
    stmt = select(Attendance).options(joinedload(Attendance.user)).where(Attendance.is_late == True, Attendance.is_penalty_approved == False)
    records = db.scalars(stmt).all()
    return [
        {
            "id": str(r.id),
            "staff_name": r.user.name,
            "date": str(r.date),
            "start_time": r.start_time.strftime("%H:%M:%S"),
            "penalty_amount": r.penalty_amount
        } for r in records
    ]

@router.post("/approve-penalty")
def approve_penalty(data: PenaltyApproval, db: Session = Depends(get_db), current_user=Depends(require_admin)):
    record = db.scalar(select(Attendance).where(Attendance.id == data.attendance_id))
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    
    if data.approve:
        record.is_penalty_approved = True
        # In a real system, you might deduct this from a 'staff_wallet' or 'ledger'
        # For now, we just mark it as approved.
    else:
        # If rejected, we remove the late flag/penalty
        record.is_late = False
        record.penalty_amount = 0.0
        
    db.commit()
    return {"message": "Penalty processed successfully"}

@router.post("/virtual-transfer")
def process_virtual_transfer(
    payload: VirtualTransferRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Atomically transfers virtual balance from Portal to Retailer or Staff."""
    try:
        import pytz
        from datetime import datetime, time as dt_time, timezone
        ist = pytz.timezone('Asia/Kolkata')
        today_ist = payload.transfer_date or datetime.now(ist).date()
        current_time_ist = datetime.now(ist).time()
        
        if payload.transfer_date:
            transfer_datetime_ist = datetime.combine(payload.transfer_date, current_time_ist)
            transfer_datetime_utc = ist.localize(transfer_datetime_ist).astimezone(pytz.utc).replace(tzinfo=None)
        else:
            transfer_datetime_utc = datetime.now(timezone.utc).replace(tzinfo=None)

        # Validate inputs early
        if not payload.retailer_id and not payload.staff_id:
            raise HTTPException(status_code=400, detail="Either retailer_id or staff_id must be provided.")

        # 1. Fetch Source Portal (locked)
        portal = db.scalar(
            select(Portal)
            .options(joinedload(Portal.group))
            .where(Portal.id == payload.portal_id)
            .with_for_update()
        )
        if not portal:
            raise HTTPException(status_code=404, detail="Source portal bank/wallet account not found.")
            
        # Lock the associated PortalGroup to prevent race conditions on group balance
        portal_group = None
        if portal.group_id:
            from app.database.models import PortalGroup
            portal_group = db.scalar(
                select(PortalGroup)
                .where(PortalGroup.id == portal.group_id)
                .with_for_update()
            )

        # Step A: Adjust Portal Balance
        if payload.direction == "refund":
            portal.balance = Decimal(str(portal.balance or 0)) + payload.amount
            if portal_group:
                portal_group.balance = Decimal(str(portal_group.balance or 0)) + payload.amount
        else:
            portal.balance = Decimal(str(portal.balance or 0)) - payload.amount
            if portal_group:
                portal_group.balance = Decimal(str(portal_group.balance or 0)) - payload.amount
            
        if payload.retailer_id:
            # Transfer to/from Retailer
            retailer = db.scalar(select(Retailer).where(Retailer.id == payload.retailer_id).with_for_update())
            if not retailer:
                raise HTTPException(status_code=404, detail="Destination retailer not found.")
                
            if payload.direction == "refund":
                desc_text = "move to distributor"
                transaction_type = "credit"
            else:
                # Safely get description text
                if portal_group:
                    desc_text = portal_group.name or "virtual transfer"
                elif portal:
                    desc_text = portal.portal_name or "virtual transfer"
                else:
                    desc_text = "virtual transfer"
                transaction_type = "debit"
            
            # Create the bank deposit audit record first with a placeholder balance
            db_deposit = BankDeposit(
                staff_id=current_user.id,
                deposit_type="virtual",
                portal_id=payload.portal_id,
                retailer_id=payload.retailer_id,
                amount=payload.amount,
                payment_mode="refund" if payload.direction == "refund" else "online",
                deposit_date=today_ist,
                created_at=transfer_datetime_utc,
                status="verified",
                balance_snapshot=Decimal("0"),
                remarks=payload.remarks
            )
            db.add(db_deposit)
            db.flush()
            
            # Create the ledger entry with a placeholder balance
            ledger_entry = Ledger(
                retailer_id=payload.retailer_id,
                transaction_type=transaction_type,
                amount=payload.amount,
                balance=Decimal("0"),
                description=desc_text,
                deposit_id=db_deposit.id,
                created_at=transfer_datetime_utc
            )
            db.add(ledger_entry)
            db.flush()
            
            # Recalculate all ledger balances from scratch — this is the single
            # source of truth and fixes any intermediate calculation errors
            from app.logic.ledger import recalculate_balances
            recalculate_balances(payload.retailer_id, db)
            db.flush()
            
            # After recalculation, re-read the final balance from the retailer
            db.refresh(retailer)
            final_balance = retailer.balance
            
            # Sync the bank deposit's balance_snapshot with the recalculated value
            recalculated_ledger = db.scalar(
                select(Ledger).where(Ledger.deposit_id == db_deposit.id)
            )
            if recalculated_ledger:
                db_deposit.balance_snapshot = recalculated_ledger.balance
            else:
                db_deposit.balance_snapshot = final_balance
            
            db.commit()
            
            return {
                "message": "Virtual transfer processed successfully",
                "portal_name": portal.portal_name,
                "target_name": retailer.retailer_name,
                "new_portal_balance": float(portal.balance),
                "new_target_balance": float(final_balance)
            }
        else:
            # Transfer to Staff
            staff = db.scalar(select(User).where(User.id == payload.staff_id).with_for_update())
            if not staff:
                raise HTTPException(status_code=404, detail="Destination staff member not found.")
            
            current_virtual_balance = Decimal(str(staff.virtual_balance or 0))
            if payload.direction == "refund":
                staff.virtual_balance = current_virtual_balance - payload.amount
            else:
                staff.virtual_balance = current_virtual_balance + payload.amount
            
            db_deposit = BankDeposit(
                staff_id=current_user.id,
                deposit_type="virtual",
                portal_id=payload.portal_id,
                recipient_staff_id=payload.staff_id,
                amount=payload.amount,
                payment_mode="refund" if payload.direction == "refund" else "online",
                deposit_date=today_ist,
                created_at=transfer_datetime_utc,
                status="verified",
                balance_snapshot=staff.virtual_balance,
                remarks=payload.remarks
            )
            db.add(db_deposit)
            
            db.commit()
            return {
                "message": "Virtual transfer processed successfully",
                "portal_name": portal.portal_name,
                "target_name": staff.name,
                "new_portal_balance": float(portal.balance),
                "new_target_balance": float(staff.virtual_balance)
            }
            
    except HTTPException:
        try:
            db.rollback()
        except Exception:
            pass
        raise
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        import traceback
        traceback.print_exc()
        print(f"[ERROR] Virtual transfer failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Virtual transfer failed: {str(e)}"
        )


