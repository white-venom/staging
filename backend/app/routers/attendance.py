from datetime import datetime, date, time
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.orm import Session
import pytz

from app.database.db import get_db
from app.database.models import Attendance, BusinessSettings
from app.schemas.attendance import CheckInRequest, CheckOutRequest, AttendanceResponse
from app.dependencies import require_staff, require_admin
from app.logic.feature_flags import require_feature

router = APIRouter(prefix="/attendance", tags=["Attendance & Shifts"])

def check_and_trigger_auto_checkout(db: Session):
    """
    Checks all active shifts. If current IST time is past the auto-checkout threshold
    for a shift's date, auto-completes that shift.
    """
    settings = db.scalar(select(BusinessSettings).where(BusinessSettings.id == 1))
    global_auto_checkout = settings.auto_checkout_time if settings and settings.auto_checkout_time else "20:00"

    ist = pytz.timezone('Asia/Kolkata')
    now_ist = datetime.now(ist)
    
    active_shifts = db.scalars(
        select(Attendance).where(Attendance.status == "active")
    ).all()
    
    updated_any = False
    for shift in active_shifts:
        user_checkout_time = shift.user.auto_checkout_time if shift.user else None
        auto_checkout_time_str = user_checkout_time or global_auto_checkout
        
        try:
            threshold_hour, threshold_min = map(int, auto_checkout_time_str.split(":"))
        except ValueError:
            threshold_hour, threshold_min = 20, 0
            
        shift_date = shift.date
        threshold_dt = ist.localize(datetime.combine(shift_date, time(threshold_hour, threshold_min)))
        
        if now_ist > threshold_dt:
            shift.status = "completed"
            shift.end_km = shift.start_km
            shift.end_time = threshold_dt.replace(tzinfo=None)
            updated_any = True
            
    if updated_any:
        db.commit()

import base64
import uuid
import os
import urllib.parse
from app.logic.r2 import is_r2_configured, upload_image_to_r2

MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB limit


def validate_and_decode_base64_image(base64_str: str) -> tuple[bytes, str]:
    """
    Validates and decodes a base64 image string.
    Returns (image_bytes, file_extension).
    Raises ValueError on client validation failure with a clean message.
    """
    if not base64_str or not isinstance(base64_str, str):
        raise ValueError("Image data is empty or invalid.")

    # URL-unquote if necessary
    if "%" in base64_str:
        base64_str = urllib.parse.unquote(base64_str)

    mime_ext = None
    # Strip data URL prefix if present (e.g. data:image/jpeg;base64,...)
    if "," in base64_str:
        header, base64_str = base64_str.split(",", 1)
        header_lower = header.lower()
        if "jpeg" in header_lower or "jpg" in header_lower:
            mime_ext = "jpg"
        elif "png" in header_lower:
            mime_ext = "png"
        elif "webp" in header_lower:
            mime_ext = "webp"
        elif "heic" in header_lower:
            mime_ext = "heic"
        elif "avif" in header_lower:
            mime_ext = "avif"

    base64_str = base64_str.strip()

    # Guard against memory exhaustion DOS (~15MB base64 string)
    if len(base64_str) > 15 * 1024 * 1024:
        raise ValueError("Image payload exceeds maximum allowed size (10MB).")

    # Fix base64 padding if needed
    missing_padding = len(base64_str) % 4
    if missing_padding:
        base64_str += "=" * (4 - missing_padding)

    # Decode base64 bytes
    try:
        image_data = base64.b64decode(base64_str)
    except Exception as e:
        raise ValueError(f"Failed to decode image data: {str(e)}")

    if len(image_data) > MAX_IMAGE_BYTES:
        raise ValueError("Decoded image exceeds maximum size limit of 10MB.")

    if len(image_data) < 16:
        raise ValueError("Image file is corrupted or too small.")

    # Validate magic byte signature (JPEG, PNG, WebP, HEIC/AVIF)
    ext = None
    if image_data.startswith(b"\xff\xd8"):
        ext = "jpg"
    elif image_data.startswith(b"\x89PNG"):
        ext = "png"
    elif image_data[:4] == b"RIFF" and b"WEBP" in image_data[:16]:
        ext = "webp"
    elif image_data[4:8] == b"ftyp" and any(brand in image_data[8:16] for brand in (b"heic", b"heix", b"mif1", b"msf1", b"avif")):
        ext = "heic"
    elif mime_ext:
        # Fallback to declared MIME type from data-url header
        ext = mime_ext
    else:
        # Permissive fallback: if data is binary and non-empty, default to jpg
        ext = "jpg"

    return image_data, ext


def save_base64_image(base64_str: str, folder: str) -> Optional[str]:
    """
    Validates, decodes, and saves base64 image to Cloudflare R2 or local storage.
    Raises ValueError only if the client uploaded invalid/corrupt image data.
    If storage fails due to server disk/network issues, logs error and returns None.
    """
    if not base64_str:
        return None

    # Step 1: Validate and decode image (raises ValueError on invalid client data)
    image_data, ext = validate_and_decode_base64_image(base64_str)

    filename = f"{uuid.uuid4().hex}.{ext}"
    content_type = f"image/{'jpeg' if ext == 'jpg' else ext}"

    # Step 2: Attempt upload to Cloudflare R2 if configured
    if is_r2_configured():
        try:
            r2_url = upload_image_to_r2(image_data, filename, content_type=content_type)
            if r2_url:
                return r2_url
            print("[WARNING] R2 upload failed or returned None. Falling back to local storage.")
        except Exception as r2_err:
            print(f"[ERROR] R2 upload exception: {r2_err}. Falling back to local storage.")

    # Step 3: Local storage fallback
    try:
        os.makedirs(folder, exist_ok=True)
        filepath = os.path.join(folder, filename)
        with open(filepath, "wb") as f:
            f.write(image_data)
        return f"/static/attendance/{filename}"
    except Exception as e:
        print(f"[ERROR] Primary local storage write failed for attendance image: {str(e)}")

    # Step 4: Emergency alternate directory fallback
    try:
        alt_folder = os.path.join(os.path.dirname(folder), "attendance")
        if alt_folder != folder:
            os.makedirs(alt_folder, exist_ok=True)
            with open(os.path.join(alt_folder, filename), "wb") as f:
                f.write(image_data)
            return f"/static/attendance/{filename}"
    except Exception as alt_err:
        print(f"[ERROR] Alternate local storage write failed: {alt_err}")

    return None



@router.post("/check-in", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED)
def check_in(
    payload: CheckInRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_staff),
    _feature=Depends(require_feature("attendance_tracking"))
):
    """Staff checks in for the day, logging their starting vehicle KM, meter image, and GPS location."""
    # Trigger auto-checkout check first to complete any pending shifts
    check_and_trigger_auto_checkout(db)
    
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

    # Get late penalty settings (field-by-field fallback to global settings)
    late_threshold_str = current_user.late_threshold
    late_penalty_val = current_user.late_penalty

    if late_threshold_str is None or late_penalty_val is None:
        settings = db.scalar(select(BusinessSettings).where(BusinessSettings.id == 1))
        if settings:
            if late_threshold_str is None:
                late_threshold_str = settings.late_threshold
            if late_penalty_val is None:
                late_penalty_val = settings.late_penalty

    # Hard default fallbacks if still None
    if late_threshold_str is None:
        late_threshold_str = "10:00"
    if late_penalty_val is None:
        late_penalty_val = 100.0

    # Check for lateness (IST Time)
    ist = pytz.timezone('Asia/Kolkata')
    now_ist = datetime.now(ist)
    
    try:
        threshold_hour, threshold_min = map(int, late_threshold_str.split(":"))
    except ValueError:
        threshold_hour, threshold_min = 10, 0
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
        try:
            image_url = save_base64_image(payload.image, static_folder)
        except ValueError as val_err:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(val_err)
            )
        except Exception as unexpected_err:
            print(f"[ERROR] Unexpected error saving check-in image: {unexpected_err}")
            image_url = None

    db_attendance = Attendance(
        user_id=current_user.id,
        date=now_ist.date(),
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
    current_user=Depends(require_staff),
    _feature=Depends(require_feature("attendance_tracking"))
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
        try:
            image_url = save_base64_image(payload.image, static_folder)
        except ValueError as val_err:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(val_err)
            )
        except Exception as unexpected_err:
            print(f"[ERROR] Unexpected error saving checkout image: {unexpected_err}")
            image_url = None

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
    check_and_trigger_auto_checkout(db)
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
    check_and_trigger_auto_checkout(db)
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
