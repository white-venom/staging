import uuid
from decimal import Decimal
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.database.models import Portal, PortalGroup
from app.schemas.portal import (
    PortalCreate, 
    PortalResponse, 
    PortalUpdate,
    PortalGroupCreate, 
    PortalGroupResponse,
    PortalGroupUpdate
)
from app.dependencies import require_admin, require_any_user

router = APIRouter(prefix="/portals", tags=["Portals & Stores"])


# --- Portal Groups ---

@router.post("/groups", response_model=PortalGroupResponse, status_code=status.HTTP_201_CREATED)
def create_portal_group(
    group_data: PortalGroupCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Admin-only endpoint to register a Portal Group (e.g., RevaPay)."""
    # Net Balance = To Take (Debit) - To Give (Credit)
    initial_balance = group_data.opening_to_take - group_data.opening_to_give
    
    db_group = PortalGroup(
        name=group_data.name,
        opening_to_give=group_data.opening_to_give,
        opening_to_take=group_data.opening_to_take,
        balance=initial_balance
    )
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    return db_group


@router.get("/groups", response_model=List[PortalGroupResponse])
def list_portal_groups(
    db: Session = Depends(get_db),
    current_user=Depends(require_any_user)
):
    """Get all Portal Groups."""
    groups = db.scalars(select(PortalGroup).order_by(PortalGroup.name)).all()
    return groups


@router.put("/groups/{group_id}", response_model=PortalGroupResponse)
def update_portal_group(
    group_id: uuid.UUID,
    group_data: PortalGroupUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Admin-only endpoint to update a Portal Group."""
    db_group = db.scalar(select(PortalGroup).where(PortalGroup.id == group_id))
    if not db_group:
        raise HTTPException(status_code=404, detail="Portal Group not found")
    
    from decimal import Decimal
    
    # Preserve transaction history by calculating the delta of opening balance changes
    old_opening_net = Decimal(str(db_group.opening_to_take or 0)) - Decimal(str(db_group.opening_to_give or 0))
    
    db_group.name = group_data.name
    if group_data.opening_to_give is not None:
        db_group.opening_to_give = Decimal(str(group_data.opening_to_give))
    if group_data.opening_to_take is not None:
        db_group.opening_to_take = Decimal(str(group_data.opening_to_take))
        
    new_opening_net = Decimal(str(db_group.opening_to_take or 0)) - Decimal(str(db_group.opening_to_give or 0))
    delta = new_opening_net - old_opening_net
    
    # Apply the change in opening balance to the current running balance
    db_group.balance += delta
    
    db.commit()
    db.refresh(db_group)
    return db_group


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_portal_group(
    group_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Admin-only endpoint to remove a portal group and all its accounts."""
    db_group = db.scalar(select(PortalGroup).where(PortalGroup.id == group_id))
    if not db_group:
        raise HTTPException(status_code=404, detail="Portal Group not found")
        
    try:
        db.delete(db_group)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error deleting portal group: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )
    return None


# --- Portal Accounts ---

@router.post("", response_model=PortalResponse, status_code=status.HTTP_201_CREATED)
def create_portal(
    portal_data: PortalCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Admin-only endpoint to register portal/store targets (Blinkit, Muthoot, etc.)."""
    # Create portal
    initial_balance = Decimal(str(portal_data.opening_to_take)) - Decimal(str(portal_data.opening_to_give))
    db_portal = Portal(
        group_id=portal_data.group_id,
        portal_name=portal_data.portal_name,
        bank_name=portal_data.bank_name,
        bank_account_no=portal_data.bank_account_no,
        ifsc_code=portal_data.ifsc_code,
        opening_to_give=portal_data.opening_to_give,
        opening_to_take=portal_data.opening_to_take,
        balance=initial_balance
    )
    
    # Also update the parent group's running balance
    group = db.scalar(select(PortalGroup).where(PortalGroup.id == portal_data.group_id))
    if group:
        group.balance += initial_balance
        
    db.add(db_portal)
    db.commit()
    db.refresh(db_portal)
    return db_portal


@router.get("", response_model=List[PortalResponse])
def list_portals(
    db: Session = Depends(get_db),
    current_user=Depends(require_any_user)
):
    """Get all active stores / portals with bank details."""
    portals = db.scalars(select(Portal).order_by(Portal.portal_name)).all()
    return portals


@router.get("/groups/{group_id}/accounts", response_model=List[PortalResponse])
def list_group_accounts(
    group_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_any_user)
):
    """Get all accounts under a specific Portal Group."""
    accounts = db.scalars(select(Portal).where(Portal.group_id == group_id).order_by(Portal.portal_name)).all()
    return accounts


@router.put("/{portal_id}", response_model=PortalResponse)
def update_portal(
    portal_id: uuid.UUID,
    portal_data: PortalUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Admin-only endpoint to update portal details."""
    db_portal = db.scalar(select(Portal).where(Portal.id == portal_id))
    if not db_portal:
        raise HTTPException(status_code=404, detail="Portal not found")
        
    # Preserve original opening balances
    from decimal import Decimal
    old_net = Decimal(str(db_portal.opening_to_take or 0)) - Decimal(str(db_portal.opening_to_give or 0))

    # Update fields safely
    for field, value in portal_data.model_dump(exclude_unset=True).items():
        setattr(db_portal, field, value)
    
    # Calculate delta and apply to balances
    new_net = Decimal(str(db_portal.opening_to_take or 0)) - Decimal(str(db_portal.opening_to_give or 0))
    delta = new_net - old_net
    
    if delta != 0:
        db_portal.balance += delta
        if db_portal.group:
            db_portal.group.balance += delta
            
    db.commit()
    db.refresh(db_portal)
    return db_portal


@router.delete("/{portal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_portal(
    portal_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Admin-only endpoint to remove a portal."""
    portal = db.scalar(select(Portal).where(Portal.id == portal_id))
    if not portal:
        raise HTTPException(status_code=404, detail="Portal not found")
        
    if portal.group:
        portal.group.balance -= portal.balance
        
    db.delete(portal)
    db.commit()
    return None
