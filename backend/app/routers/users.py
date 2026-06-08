import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.database.models import User
from app.schemas.auth import UserCreate, UserResponse, UserUpdate
from app.core.security import get_password_hash
from app.dependencies import require_admin, require_any_user

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
    # Check if phone already exists
    existing_user = db.scalar(select(User).where(User.phone == user_data.phone))
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this phone number already exists."
        )

    db_user = User(
        name=user_data.name,
        phone=user_data.phone,
        role=user_data.role,
        password_hash=get_password_hash(user_data.password)
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
    current_user=Depends(require_admin)
):
    """Admin-only endpoint to update a user (name, phone, role, password)."""
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.name = user_data.name
    user.phone = user_data.phone
    user.role = user_data.role
    if user_data.password:
        user.password_hash = get_password_hash(user_data.password)
    
    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Admin-only endpoint to delete a user."""
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Admins cannot be deleted.")

    # Soft delete instead of hard delete to preserve past records
    user.is_active = False
    db.commit()
    return None
