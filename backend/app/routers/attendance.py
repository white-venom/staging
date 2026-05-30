from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.orm import Session
import pytz

from app.database.db import get_db
from app.database.models import Attendance, BusinessSettings
from app.schemas.attendance import CheckInRequest, CheckOutRequest, AttendanceResponse
from app.dependencies import require_staff, require_admin

router = APIRouter(prefix="/attendance", tags=["Attendance & Shifts"])

import base64
import uuid
import os
from app.logic.r2 import is_r2_configured, upload_image_to_r2

def save_base64_image(base64_str: str, folder: str) -> str:
    """Decodes base64 image string and saves to Cloudflare R2 if configured, or falls back to local static directory, returning URL."""
    try:
        if not base64_str:
            return None
        # Strip data URL prefix if present
        if "," in base64_str:
            base64_str = base64_str.split(",")[1]
        
        image_data = base64.b64decode(base64_str)
        filename = f"{uuid.uuid4().hex}.jpg"
        
        # If R2 credentials are set up, attempt upload to Cloudflare R2
        if is_r2_configured():
            r2_url = upload_image_to_r2(image_data, filename)
            if r2_url:
                return r2_url
            print("[WARNING] R2 upload failed. Falling back to local storage.")
        
        # Local storage fallback
        os.makedirs(folder, exist_ok=True)
        filepath = os.path.join(folder, filename)
        
        with open(filepath, "wb") as f:
            f.write(image_data)
            
        return f"/static/attendance/{filename}"
    except Exception as e:
        print(f"Error saving base64 image: {str(e)}")
        return None



@router.post("/check-in", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED)
def check_in(
    payload: CheckInRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_staff)
):
    """Staff checks in for the day, logging their starting vehicle KM, meter image, and GPS location."""
    # Check if they already have an active check-in session for today
    existing = db.scalar(
        select(Attendance).where(
            and_(
                Attendance.user_id == current_user.id,
                Attendance.status == "active"
            )
        )
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"You already have an active shift started at {existing.start_time.strftime('%H:%M:%S')} today!"
        )

    # Get late penalty settings
    settings = db.scalar(select(BusinessSettings).where(BusinessSettings.id == 1))
    if not settings:
        # Fallback if settings not found
        late_threshold_str = "10:00"
        late_penalty_val = 100.0
    else:
        late_threshold_str = settings.late_threshold
        late_penalty_val = settings.late_penalty

    # Check for lateness (IST Time)
    ist = pytz.timezone('Asia/Kolkata')
    now_ist = datetime.now(ist)
    
    threshold_hour, threshold_min = map(int, late_threshold_str.split(":"))
    threshold_time = now_ist.replace(hour=threshold_hour, minute=threshold_min, second=0, microsecond=0)
    
    is_late = now_ist > threshold_time
    penalty_amount = late_penalty_val if is_late else 0.0

    # Save meter image if uploaded
    image_url = None
    if payload.image:
        static_folder = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "static",
            "attendance"
        )
        image_url = save_base64_image(payload.image, static_folder)

    db_attendance = Attendance(
        user_id=current_user.id,
        date=date.today(),
        start_km=payload.start_km,
        start_time=now_ist.replace(tzinfo=None),
        status="active",
        is_late=is_late,
        penalty_amount=penalty_amount,
        is_penalty_approved=False, # Admin must approve later
        start_km_image_url=image_url,
        start_latitude=payload.latitude,
        start_longitude=payload.longitude
    )
    db.add(db_attendance)
    db.commit()
    db.refresh(db_attendance)
    return db_attendance


@router.post("/check-out", response_model=AttendanceResponse)
def check_out(
    payload: CheckOutRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_staff)
):
    """Staff checks out, logging ending KM, checkout meter image, and GPS location to complete shift."""
    active_shift = db.scalar(
        select(Attendance).where(
            and_(
                Attendance.user_id == current_user.id,
                Attendance.status == "active"
            )
        )
    )
    if not active_shift:
        raise HTTPException(status_code=400, detail="You do not have any active shift sessions to check out from.")

    # Validate that ending KM is strictly greater than starting KM
    if payload.end_km < active_shift.start_km:
        raise HTTPException(
            status_code=400,
            detail=f"Checkout mileage ({payload.end_km} KM) cannot be less than starting mileage ({active_shift.start_km} KM)!"
        )

    ist = pytz.timezone('Asia/Kolkata')
    now_ist = datetime.now(ist)
    
    # Save checkout image if uploaded
    image_url = None
    if payload.image:
        static_folder = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "static",
            "attendance"
        )
        image_url = save_base64_image(payload.image, static_folder)

    # Complete shift
    active_shift.end_km = payload.end_km
    active_shift.end_time = now_ist.replace(tzinfo=None)
    active_shift.status = "completed"
    active_shift.end_km_image_url = image_url
    active_shift.end_latitude = payload.latitude
    active_shift.end_longitude = payload.longitude
    
    db.commit()
    db.refresh(active_shift)
    return active_shift
@router.get("/my-status", response_model=AttendanceResponse)
def get_my_attendance_status(
    db: Session = Depends(get_db),
    current_user=Depends(require_staff)
):
    """Get the current user's active attendance session for today."""
    active_shift = db.scalar(
        select(Attendance).where(
            and_(
                Attendance.user_id == current_user.id,
                Attendance.status == "active"
            )
        )
    )
    if not active_shift:
        raise HTTPException(status_code=404, detail="No active shift found.")
    return active_shift


@router.get("/today")
def get_today_attendance(
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Get all attendance records for today (for admin)."""
    ist = pytz.timezone('Asia/Kolkata')
    today = datetime.now(ist).date()
    
    # We join with User to get the staff name
    from app.database.models import User
    
    results = db.execute(
        select(Attendance, User.name)
        .join(User, Attendance.user_id == User.id)
        .where(Attendance.date == today)
    ).all()
    
    return [
        {
            "id": str(att.id),
            "staff_id": str(att.user_id),
            "staff_name": name,
            "date": att.date.isoformat(),
            "start_km": att.start_km,
            "end_km": att.end_km,
            "start_time": att.start_time.strftime("%H:%M") if att.start_time else None,
            "end_time": att.end_time.strftime("%H:%M") if att.end_time else None,
            "duration": _calculate_duration(att),
            "status": att.status,
            "is_late": att.is_late,
            "penalty_amount": att.penalty_amount,
            "start_km_image_url": att.start_km_image_url,
            "end_km_image_url": att.end_km_image_url,
            "start_latitude": att.start_latitude,
            "start_longitude": att.start_longitude,
            "end_latitude": att.end_latitude,
            "end_longitude": att.end_longitude
        }
        for att, name in results
    ]

def _calculate_duration(att):
    if not att.start_time:
        return "0h 0m"
    ist = pytz.timezone('Asia/Kolkata')
    end = att.end_time or datetime.now(ist).replace(tzinfo=None)
    diff = end - att.start_time
    hours, remainder = divmod(int(diff.total_seconds()), 3600)
    minutes, _ = divmod(remainder, 60)
    return f"{hours}h {minutes}m"
