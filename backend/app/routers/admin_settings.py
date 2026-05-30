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

class PenaltyApproval(BaseModel):
    attendance_id: uuid.UUID
    approve: bool

class VirtualTransferRequest(BaseModel):
    portal_id: uuid.UUID
    retailer_id: Optional[uuid.UUID] = None
    staff_id: Optional[uuid.UUID] = None
    amount: Decimal = Field(..., gt=0)
    remarks: Optional[str] = None

@router.get("/business", response_model=dict)
def get_business_settings(db: Session = Depends(get_db), current_user=Depends(require_admin)):
    settings = db.scalar(select(BusinessSettings).where(BusinessSettings.id == 1))
    if not settings:
        return {"late_threshold": "10:00", "late_penalty": 100.0}
    return {
        "late_threshold": settings.late_threshold,
        "late_penalty": settings.late_penalty
    }

@router.put("/business")
def update_business_settings(data: SettingsUpdate, db: Session = Depends(get_db), current_user=Depends(require_admin)):
    settings = db.scalar(select(BusinessSettings).where(BusinessSettings.id == 1))
    if not settings:
        settings = BusinessSettings(id=1, late_threshold=data.late_threshold, late_penalty=data.late_penalty)
        db.add(settings)
    else:
        settings.late_threshold = data.late_threshold
        settings.late_penalty = data.late_penalty
    db.commit()
    return {"message": "Settings updated successfully"}

@router.get("/pending-penalties")
def list_pending_penalties(db: Session = Depends(get_db), current_user=Depends(require_admin)):
    """List all attendance records that are late but penalty is not yet approved."""
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
    # 1. Fetch Source Portal
    portal = db.scalar(select(Portal).where(Portal.id == payload.portal_id).with_for_update())
    if not portal:
        raise HTTPException(status_code=404, detail="Source portal bank/wallet account not found.")
        
    if not payload.retailer_id and not payload.staff_id:
        raise HTTPException(status_code=400, detail="Either retailer_id or staff_id must be provided.")
        
    try:
        # Step A: Decrement Portal Balance and To Give
        portal.balance -= payload.amount
        portal.opening_to_give = (portal.opening_to_give or Decimal("0.00")) - payload.amount
        if portal.group:
            portal.group.balance -= payload.amount
            portal.group.opening_to_give = (portal.group.opening_to_give or Decimal("0.00")) - payload.amount
            
        if payload.retailer_id:
            # Transfer to Retailer
            retailer = db.scalar(select(Retailer).where(Retailer.id == payload.retailer_id).with_for_update())
            if not retailer:
                raise HTTPException(status_code=404, detail="Destination retailer not found.")
                
            # Add virtual transfer amount to retailer's "To Give" balance
            retailer.opening_to_give = (retailer.opening_to_give or Decimal("0.00")) + payload.amount
            
            # Log in bank deposits to keep audit trail
            db_deposit = BankDeposit(
                staff_id=current_user.id,
                deposit_type="virtual",
                portal_id=payload.portal_id,
                retailer_id=payload.retailer_id,
                amount=payload.amount,
                payment_mode="online",
                deposit_date=date.today(),
                status="verified",
                balance_snapshot=retailer.opening_to_give
            )
            db.add(db_deposit)
            
            # Recalculate ledger balances to reflect the updated opening_to_give
            from app.logic.ledger import recalculate_balances
            recalculate_balances(payload.retailer_id, db)
            
            db.commit()
            db.refresh(retailer)
            return {
                "message": "Virtual transfer processed successfully",
                "portal_name": portal.portal_name,
                "target_name": retailer.retailer_name,
                "new_portal_balance": float(portal.balance),
                "new_target_balance": float(retailer.opening_to_give)
            }
        else:
            # Transfer to Staff
            staff = db.scalar(select(User).where(User.id == payload.staff_id).with_for_update())
            if not staff:
                raise HTTPException(status_code=404, detail="Destination staff member not found.")
                
            staff.virtual_balance += payload.amount
            
            # Record in bank deposits to keep log details
            db_deposit = BankDeposit(
                staff_id=current_user.id,
                deposit_type="virtual",
                portal_id=payload.portal_id,
                recipient_staff_id=payload.staff_id,
                amount=payload.amount,
                payment_mode="online",
                deposit_date=date.today(),
                status="verified",
                balance_snapshot=staff.virtual_balance
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
            
    except Exception as e:
        db.rollback()
        print(f"Error in virtual transfer: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred during the virtual transfer."
        )

