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
    if group_data.opening_to_take < 0 or group_data.opening_to_give < 0:
        raise HTTPException(status_code=400, detail="Opening balances cannot be negative")
        
    initial_balance = Decimal(str(group_data.opening_to_take)) - Decimal(str(group_data.opening_to_give))
    
    db_group = PortalGroup(
        name=group_data.name,
        opening_to_give=group_data.opening_to_give,
        opening_to_take=group_data.opening_to_take,
        balance=initial_balance
    )
    db.add(db_group)
    db.commit()
    db.refresh(db_group)

    # Automatically create a default Primary Account for the new Portal Group
    db_portal = Portal(
        group_id=db_group.id,
        portal_name="Primary Account",
        opening_to_give=db_group.opening_to_give,
        opening_to_take=db_group.opening_to_take,
        balance=db_group.balance,
        show_in_online_payment=group_data.show_in_online_payment
    )
    db.add(db_portal)
    db.commit()
    db.refresh(db_group)
    return db_group


@router.get("/groups", response_model=List[PortalGroupResponse])
def list_portal_groups(
    db: Session = Depends(get_db),
    current_user=Depends(require_any_user)
):
    """Get all Portal Groups."""
    from sqlalchemy.orm import joinedload
    groups = db.scalars(select(PortalGroup).options(joinedload(PortalGroup.portals)).order_by(PortalGroup.name)).unique().all()
    
    # Auto-heal: Ensure every group has at least one portal account (e.g. Primary Account)
    healed = False
    for group in groups:
        if len(group.portals) == 0:
            primary_portal = Portal(
                group_id=group.id,
                portal_name="Primary Account",
                opening_to_give=Decimal("0.00"),
                opening_to_take=Decimal("0.00"),
                balance=group.balance,
                show_in_online_payment=True
            )
            db.add(primary_portal)
            healed = True
            
    if healed:
        db.commit()
        # Re-fetch healed groups
        groups = db.scalars(select(PortalGroup).options(joinedload(PortalGroup.portals)).order_by(PortalGroup.name)).unique().all()
        
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
    
    if group_data.opening_to_give is not None and group_data.opening_to_give < 0:
        raise HTTPException(status_code=400, detail="To Give cannot be negative")
    if group_data.opening_to_take is not None and group_data.opening_to_take < 0:
        raise HTTPException(status_code=400, detail="To Take cannot be negative")

    from decimal import Decimal
    
    db_group.name = group_data.name
    if group_data.opening_to_give is not None:
        delta_give = Decimal(str(group_data.opening_to_give))
        db_group.opening_to_give = (db_group.opening_to_give or Decimal("0.00")) + delta_give
        db_group.balance = (db_group.balance or Decimal("0.00")) - delta_give
    if group_data.opening_to_take is not None:
        delta_take = Decimal(str(group_data.opening_to_take))
        db_group.opening_to_take = (db_group.opening_to_take or Decimal("0.00")) + delta_take
        db_group.balance = (db_group.balance or Decimal("0.00")) + delta_take
    if group_data.show_in_online_payment is not None:
        for portal in db_group.portals:
            portal.show_in_online_payment = group_data.show_in_online_payment
    
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
            detail="An internal error occurred while deleting the portal group."
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
    if portal_data.opening_to_take < 0 or portal_data.opening_to_give < 0:
        raise HTTPException(status_code=400, detail="Opening balances cannot be negative")
        
    # Create portal
    initial_balance = Decimal(str(portal_data.opening_to_take)) - Decimal(str(portal_data.opening_to_give))
    db_portal = Portal(
        group_id=portal_data.group_id,
        portal_name=portal_data.portal_name,
        bank_name=portal_data.bank_name,
        bank_account_no=portal_data.bank_account_no,
        ifsc_code=portal_data.ifsc_code,
        show_in_online_payment=portal_data.show_in_online_payment,
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
    from sqlalchemy.orm import joinedload
    portals = db.scalars(select(Portal).options(joinedload(Portal.group)).order_by(Portal.portal_name)).all()
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
        
    if portal_data.opening_to_give is not None and portal_data.opening_to_give < 0:
        raise HTTPException(status_code=400, detail="To Give cannot be negative")
    if portal_data.opening_to_take is not None and portal_data.opening_to_take < 0:
        raise HTTPException(status_code=400, detail="To Take cannot be negative")

    # Update fields safely
    for field, value in portal_data.model_dump(exclude_unset=True).items():
        if field not in ["opening_to_give", "opening_to_take"]:
            setattr(db_portal, field, value)
    
    from decimal import Decimal
    if portal_data.opening_to_give is not None:
        delta_give = Decimal(str(portal_data.opening_to_give))
        db_portal.opening_to_give = (db_portal.opening_to_give or Decimal("0.00")) + delta_give
        db_portal.balance = (db_portal.balance or Decimal("0.00")) - delta_give
        if db_portal.group:
            db_portal.group.balance = (db_portal.group.balance or Decimal("0.00")) - delta_give
    if portal_data.opening_to_take is not None:
        delta_take = Decimal(str(portal_data.opening_to_take))
        db_portal.opening_to_take = (db_portal.opening_to_take or Decimal("0.00")) + delta_take
        db_portal.balance = (db_portal.balance or Decimal("0.00")) + delta_take
        if db_portal.group:
            db_portal.group.balance = (db_portal.group.balance or Decimal("0.00")) + delta_take
            
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
        
    group = portal.group
    if group:
        group.balance -= portal.balance
        
    db.delete(portal)
    db.commit()
    
    # If the group has no portal accounts left, recreate a Primary Account
    if group:
        db.refresh(group)
        if len(group.portals) == 0:
            primary_portal = Portal(
                group_id=group.id,
                portal_name="Primary Account",
                opening_to_give=Decimal("0.00"),
                opening_to_take=Decimal("0.00"),
                balance=group.balance,
                show_in_online_payment=True
            )
            db.add(primary_portal)
            db.commit()
            
    return None


@router.get("/{portal_id}/ledger")
def get_portal_ledger(
    portal_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_any_user)
):
    """Fetch chronological transaction ledger for a portal/bank/wallet account."""
    from sqlalchemy import and_
    from sqlalchemy.orm import joinedload
    from app.database.models import BankDeposit, Collection
    
    portal = db.scalar(
        select(Portal)
        .options(joinedload(Portal.group))
        .where(Portal.id == portal_id)
    )
    if not portal:
        raise HTTPException(status_code=404, detail="Portal not found")

    # Fetch verified bank deposits for this portal
    deposits = db.scalars(
        select(BankDeposit)
        .options(joinedload(BankDeposit.retailer))
        .where(
            and_(
                BankDeposit.portal_id == portal_id,
                BankDeposit.status == "verified",
                BankDeposit.deposit_type == "portal"
            )
        )
    ).all()

    # Fetch verified collections for this portal
    collections = db.scalars(
        select(Collection)
        .options(joinedload(Collection.retailer))
        .where(
            and_(
                Collection.portal_id == portal_id,
                Collection.status == "verified",
                Collection.retailer_id == None
            )
        )
    ).all()

    # Merge and sort chronologically
    tx_list = []
    
    for d in deposits:
        # Bank deposit into portal (cash deposit or online auto-route)
        retailer_name = d.retailer.retailer_name if d.retailer else None
        if d.deposit_type == "portal":
            tx_type = "credit" # You Got
            amount = float(d.amount)
            desc_text = "Cash Deposit" if d.payment_mode == "cash" else "Online Payment through QR"
            if retailer_name:
                desc_text += f" from {retailer_name}"
            if d.remarks:
                desc_text += f" ({d.remarks})"
        elif d.deposit_type == "virtual":
            if d.payment_mode == "refund":
                tx_type = "credit" # You Got
                amount = float(d.amount)
                desc_text = "Virtual Refund"
                if retailer_name:
                    desc_text += f" from {retailer_name}"
            else:
                tx_type = "debit" # You Gave
                amount = float(d.amount)
                desc_text = "Virtual Transfer"
                if retailer_name:
                    desc_text += f" to {retailer_name}"
            if d.remarks:
                desc_text += f" ({d.remarks})"
        else:
            continue
            
        tx_list.append({
            "id": str(d.id),
            "created_at": d.created_at,
            "transaction_type": tx_type,
            "amount": amount,
            "description": desc_text
        })

    for c in collections:
        # Collection associated with portal (normally cash collection associated with portal)
        tx_list.append({
            "id": str(c.id),
            "created_at": c.created_at,
            "transaction_type": "debit", # You Gave (decreases portal balance)
            "amount": float(c.total_amount),
            "description": f"Collection from {c.retailer.retailer_name if c.retailer else 'Retailer'}" + (f" ({c.remarks})" if c.remarks else "")
        })

    # Sort transactions by created_at ascending to calculate running balance
    tx_list.sort(key=lambda x: x["created_at"])

    # Calculate running balance
    running_balance = float(portal.opening_to_take - portal.opening_to_give)
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
            "description": tx["description"]
        })

    return {
        "portal_name": portal.portal_name,
        "group_name": portal.group.name if portal.group else None,
        "bank_name": portal.bank_name,
        "bank_account_no": portal.bank_account_no,
        "ifsc_code": portal.ifsc_code,
        "outstanding_balance": float(portal.balance),
        "statement_history": formatted_txs
    }


@router.get("/groups/{group_id}/ledger")
def get_portal_group_ledger(
    group_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_any_user)
):
    """Fetch chronological consolidated transaction ledger for a portal group (e.g. PAYNEARBY)."""
    from sqlalchemy import and_, select
    from sqlalchemy.orm import joinedload
    from app.database.models import BankDeposit, Collection, Portal
    
    group = db.scalar(select(PortalGroup).where(PortalGroup.id == group_id))
    if not group:
        raise HTTPException(status_code=404, detail="Portal group not found")
        
    # Get all portal IDs in this group
    portals = db.scalars(select(Portal).where(Portal.group_id == group_id)).all()
    portal_ids = [p.id for p in portals]
    
    if not portal_ids:
        # No accounts, return empty ledger starting from group opening balances
        return {
            "group_name": group.name,
            "outstanding_balance": float(group.balance),
            "statement_history": []
        }
        
    # Fetch verified deposits for these portals
    deposits = db.scalars(
        select(BankDeposit)
        .options(joinedload(BankDeposit.retailer), joinedload(BankDeposit.portal))
        .where(
            and_(
                BankDeposit.portal_id.in_(portal_ids),
                BankDeposit.status == "verified"
            )
        )
    ).all()
    
    # Fetch verified direct collections for these portals (where retailer_id is None)
    collections = db.scalars(
        select(Collection)
        .options(joinedload(Collection.retailer), joinedload(Collection.portal))
        .where(
            and_(
                Collection.portal_id.in_(portal_ids),
                Collection.status == "verified",
                Collection.retailer_id == None
            )
        )
    ).all()
    
    tx_list = []
    
    for d in deposits:
        retailer_name = d.retailer.retailer_name if d.retailer else None
        p_name = d.portal.portal_name if d.portal else "Account"
        if d.deposit_type == "portal":
            tx_type = "credit"
            amount = float(d.amount)
            desc_text = f"[{p_name}] Cash Deposit" if d.payment_mode == "cash" else f"[{p_name}] Online Payment through QR"
            if retailer_name:
                desc_text += f" from {retailer_name}"
            if d.remarks:
                desc_text += f" ({d.remarks})"
        elif d.deposit_type == "virtual":
            if d.payment_mode == "refund":
                tx_type = "credit"
                amount = float(d.amount)
                desc_text = f"[{p_name}] Virtual Refund"
                if retailer_name:
                    desc_text += f" from {retailer_name}"
            else:
                tx_type = "debit"
                amount = float(d.amount)
                desc_text = f"[{p_name}] Virtual Transfer"
                if retailer_name:
                    desc_text += f" to {retailer_name}"
            if d.remarks:
                desc_text += f" ({d.remarks})"
        else:
            continue
            
        tx_list.append({
            "id": str(d.id),
            "created_at": d.created_at,
            "transaction_type": tx_type,
            "amount": amount,
            "description": desc_text
        })
        
    for c in collections:
        p_name = c.portal.portal_name if c.portal else "Account"
        tx_list.append({
            "id": str(c.id),
            "created_at": c.created_at,
            "transaction_type": "debit",
            "amount": float(c.total_amount),
            "description": f"[{p_name}] Collection from {c.retailer.retailer_name if c.retailer else 'Retailer'}" + (f" ({c.remarks})" if c.remarks else "")
        })
        
    tx_list.sort(key=lambda x: x["created_at"])
    
    running_balance = float(group.opening_to_take - group.opening_to_give)
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
            "description": tx["description"]
        })
        
    return {
        "group_name": group.name,
        "outstanding_balance": float(group.balance),
        "statement_history": formatted_txs
    }
