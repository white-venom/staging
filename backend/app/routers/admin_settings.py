import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database.db import get_db
from app.database.models import BusinessSettings, Attendance
from app.dependencies import require_admin

router = APIRouter(prefix="/admin-settings", tags=["Admin Control Panel"])

class SettingsUpdate(BaseModel):
    late_threshold: str
    late_penalty: float

class PenaltyApproval(BaseModel):
    attendance_id: uuid.UUID
    approve: bool

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
    stmt = select(Attendance).where(Attendance.is_late == True, Attendance.is_penalty_approved == False)
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
