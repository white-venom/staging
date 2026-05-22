import uuid
from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update, desc
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel, Field

from app.database.db import get_db
from app.database.models import BusinessSettings, Attendance, Portal, Retailer, Ledger
from app.dependencies import require_admin

router = APIRouter(prefix="/admin-settings", tags=["Admin Control Panel"])

class SettingsUpdate(BaseModel):
    late_threshold: str
    late_penalty: float

class PenaltyApproval(BaseModel):
    attendance_id: uuid.UUID
    approve: bool

class VirtualTransferRequest(BaseModel):
    portal_id: uuid.UUID
    retailer_id: uuid.UUID
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
    """Atomically transfers virtual balance from Portal to Retailer and logs a ledger debit entry."""
    # 1. Fetch Source Portal
    portal = db.scalar(select(Portal).where(Portal.id == payload.portal_id))
    if not portal:
        raise HTTPException(status_code=404, detail="Source portal bank/wallet account not found.")
        
    # 2. Fetch Destination Retailer
    retailer = db.scalar(select(Retailer).where(Retailer.id == payload.retailer_id))
    if not retailer:
        raise HTTPException(status_code=404, detail="Destination retailer not found.")
        
    try:
        # Step A: Decrement Portal Balance
        portal.balance -= payload.amount
        if portal.group:
            portal.group.balance -= payload.amount
            
        # Step B: Fetch latest ledger entry to calculate new running balance
        latest_ledger = db.scalar(
            select(Ledger)
            .where(Ledger.retailer_id == payload.retailer_id)
            .order_by(desc(Ledger.created_at), desc(Ledger.id))
            .limit(1)
        )
        
        if latest_ledger:
            prev_balance = latest_ledger.balance
        else:
            prev_balance = Decimal(str(retailer.opening_to_take or 0)) - Decimal(str(retailer.opening_to_give or 0))
            
        new_balance = prev_balance + payload.amount
        
        # Step C: Log a 'debit' entry in Retailer's Ledger
        desc_text = f"Virtual Portal Transfer from {portal.portal_name}"
        if payload.remarks:
            desc_text += f" ({payload.remarks})"
            
        ledger_entry = Ledger(
            retailer_id=payload.retailer_id,
            transaction_type="debit",
            amount=payload.amount,
            balance=new_balance,
            description=desc_text
        )
        db.add(ledger_entry)
        
        # Step D: Update retailer outstanding balance cache
        retailer.balance = new_balance
        
        # Commit transaction atomically
        db.commit()
        
        return {
            "message": "Virtual transfer processed successfully",
            "portal_name": portal.portal_name,
            "retailer_name": retailer.retailer_name,
            "new_portal_balance": float(portal.balance),
            "new_retailer_balance": float(retailer.balance)
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transaction failed: {str(e)}"
        )

