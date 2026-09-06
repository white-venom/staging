import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.database.models import User
from app.schemas.auth import UserCreate, UserResponse, UserUpdate
from app.core.security import get_password_hash
from app.dependencies import require_admin, require_any_user, require_entity_edit_allowed

router = APIRouter(prefix="/users", tags=["User Management"])

@router.get("/staff-list")
def list_staff_only(
    db: Session = Depends(get_db),
    current_user=Depends(require_any_user)
):
    """Returns basic id+name list of all staff users. Accessible to any authenticated user (for deposit form dropdowns)."""
    users = db.scalars(select(User).where(User.role == "staff", User.is_active == True).order_by(User.name)).all()
    return [{"id": str(u.id), "name": u.name, "virtual_balance": float(u.virtual_balance)} for u in users]


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Admin-only endpoint to create new users (Staff or Admin)."""
    # Check if phone already exists (including soft-deleted users)
    existing_user = db.scalar(select(User).where(User.phone == user_data.phone))
    if existing_user:
        if not existing_user.is_active:
            # Re-activate and update the existing soft-deleted user
            existing_user.name = user_data.name
            existing_user.role = user_data.role
            existing_user.password_hash = get_password_hash(user_data.password)
            existing_user.late_threshold = user_data.late_threshold
            existing_user.late_penalty = user_data.late_penalty
            existing_user.auto_checkout_time = user_data.auto_checkout_time
            existing_user.is_active = True
            
            # Reset virtual balance for the re-added staff member
            from decimal import Decimal
            existing_user.virtual_balance = Decimal("0.00")
            
            db.commit()
            db.refresh(existing_user)
            return existing_user
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this phone number already exists."
            )

    db_user = User(
        name=user_data.name,
        phone=user_data.phone,
        role=user_data.role,
        password_hash=get_password_hash(user_data.password),
        late_threshold=user_data.late_threshold,
        late_penalty=user_data.late_penalty,
        auto_checkout_time=user_data.auto_checkout_time
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.get("", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Admin-only endpoint to list all users."""
    users = db.scalars(select(User).where(User.is_active == True).order_by(User.name)).all()
    return users

@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: uuid.UUID,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
    _edit_gate=Depends(require_entity_edit_allowed)
):
    """Admin-only endpoint to update a user (name, phone, role, password).
    Superadmin-gated per-tenant -- see item #3."""
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if new phone is already taken by another user (active or inactive)
    if user.phone != user_data.phone:
        existing_phone = db.scalar(select(User).where(User.phone == user_data.phone))
        if existing_phone:
            status_desc = "active" if existing_phone.is_active else "inactive"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Another {status_desc} user with this phone number already exists."
            )
            
    user.name = user_data.name
    user.phone = user_data.phone
    user.role = user_data.role
    user.late_threshold = user_data.late_threshold
    user.late_penalty = user_data.late_penalty
    user.auto_checkout_time = user_data.auto_checkout_time
    if user_data.password:
        user.password_hash = get_password_hash(user_data.password)
    
    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
    _edit_gate=Depends(require_entity_edit_allowed)
):
    """Admin-only endpoint to delete a user."""
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account.")

    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Admin accounts cannot be deleted by tenant admins. Contact SuperAdmin support.")

    # Prevent deleting staff with non-zero balances
    if user.role == "staff":
        from decimal import Decimal
        from app.database.models import Collection, BankDeposit
        from sqlalchemy.sql import func

        # Check virtual balance
        if user.virtual_balance != 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete staff with non-zero virtual balance (Current: {user.virtual_balance})."
            )

        # Check cash in hand balance
        collections_sum = db.scalar(
            select(func.coalesce(func.sum(Collection.total_amount), 0))
            .where(Collection.staff_id == user_id, Collection.from_staff_id == None)
        ) or Decimal("0.00")
        
        received_sum = db.scalar(
            select(func.coalesce(func.sum(BankDeposit.amount), 0))
            .where(BankDeposit.recipient_staff_id == user_id, BankDeposit.deposit_type == "staff", BankDeposit.status == "verified")
        ) or Decimal("0.00")
        
        sent_sum = db.scalar(
            select(func.coalesce(func.sum(BankDeposit.amount), 0))
            .where(BankDeposit.staff_id == user_id)
        ) or Decimal("0.00")
        
        net_cash_balance = collections_sum + received_sum - sent_sum
        if net_cash_balance != 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete staff with non-zero cash balance (Current: {net_cash_balance})."
            )

    # Soft delete instead of hard delete to preserve past records
    user.is_active = False
    db.commit()
    return None
