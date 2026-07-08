import uuid
from decimal import Decimal
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, or_
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
    
    if group_data.opening_to_give is not None:
        new_give = (db_group.opening_to_give or Decimal("0.00")) + Decimal(str(group_data.opening_to_give))
        if new_give < 0:
            raise HTTPException(status_code=400, detail="To Give cannot be negative")
    if group_data.opening_to_take is not None:
        new_take = (db_group.opening_to_take or Decimal("0.00")) + Decimal(str(group_data.opening_to_take))
        if new_take < 0:
            raise HTTPException(status_code=400, detail="To Take cannot be negative")

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
        
    if portal_data.opening_to_give is not None:
        new_give = (db_portal.opening_to_give or Decimal("0.00")) + Decimal(str(portal_data.opening_to_give))
        if new_give < 0:
            raise HTTPException(status_code=400, detail="To Give cannot be negative")
    if portal_data.opening_to_take is not None:
        new_take = (db_portal.opening_to_take or Decimal("0.00")) + Decimal(str(portal_data.opening_to_take))
        if new_take < 0:
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

    from app.database.models import Store
    
    # Fetch verified bank deposits for this portal (portal + virtual + portal_transfer types)
    deposits = db.scalars(
        select(BankDeposit)
        .options(
            joinedload(BankDeposit.retailer),
            joinedload(BankDeposit.denominations),
            joinedload(BankDeposit.from_portal).joinedload(Portal.group),
            joinedload(BankDeposit.portal).joinedload(Portal.group)
        )
        .where(
            and_(
                BankDeposit.status == "verified",
                BankDeposit.deposit_type.in_(["portal", "virtual", "portal_transfer"]),
                or_(
                    BankDeposit.portal_id == portal_id,
                    BankDeposit.from_portal_id == portal_id
                )
            )
        )
    ).all()

    # Fetch verified collections for this portal
    collections = db.scalars(
        select(Collection)
        .options(joinedload(Collection.retailer), joinedload(Collection.denominations))
        .where(
            and_(
                Collection.portal_id == portal_id,
                Collection.status == "verified",
                Collection.retailer_id == None
            )
        )
    ).all()

    # Fetch all verified collections across this portal's whole group (not just
    # this single portal_id) to load store/retailer name in memory. A deposit
    # can be edited to move it to a different portal within the same group
    # after the fact — the collection that originally generated it keeps its
    # own portal_id, so the source lookup below has to search the whole group
    # or it silently loses the retailer/store name for moved entries.
    group_portal_ids = [portal_id]
    if portal.group_id:
        group_portal_ids = [
            p.id for p in db.scalars(select(Portal).where(Portal.group_id == portal.group_id)).all()
        ]
    all_portal_cols = db.scalars(
        select(Collection)
        .options(joinedload(Collection.retailer), joinedload(Collection.store))
        .where(
            and_(
                Collection.portal_id.in_(group_portal_ids),
                Collection.status == "verified"
            )
        )
    ).all()

    # Group collections by (date, retailer_id) and date for fast lookup. Multiple
    # collections can share the same (portal, date) with no retailer_id, so keep all
    # of them per date instead of letting one silently overwrite the rest.
    col_by_date_retailer = {}
    col_by_date = {}
    for col in sorted(all_portal_cols, key=lambda c: c.created_at):
        col_date = col.collection_date
        if col.retailer_id:
            col_by_date_retailer[(col_date, col.retailer_id)] = col
        col_by_date.setdefault(col_date, []).append(col)

    def _best_date_match(col_date, deposit_amount):
        candidates = col_by_date.get(col_date) or []
        if not candidates:
            return None
        for c in candidates:
            online_amt = c.denominations.online_amount if c.denominations else None
            if online_amt is not None and Decimal(str(online_amt)) == Decimal(str(deposit_amount)):
                return c
        # No unambiguous amount match — only safe to guess when there's exactly one candidate.
        return candidates[0] if len(candidates) == 1 else None

    # Merge and sort chronologically
    tx_list = []

    for d in deposits:
        # Bank deposit into portal (cash deposit or online auto-route)
        retailer_name = d.retailer.retailer_name if d.retailer else None

        # For online portal deposits without retailer, try to find the matching collection
        # to get store name (legacy data that didn't store retailer_id on the deposit)
        store_name = None
        fallback_remarks = d.remarks
        if d.deposit_type == "portal" and d.payment_mode == "online" and not retailer_name:
            matching_col = _best_date_match(d.deposit_date, d.amount)
            if matching_col:
                retailer_name = matching_col.retailer.retailer_name if matching_col.retailer else None
                store_name = matching_col.store.store_name if matching_col.store else None
                if not fallback_remarks:
                    fallback_remarks = matching_col.remarks
        elif d.retailer:
            # If retailer is available, look up store from matching collection
            matching_col = col_by_date_retailer.get((d.deposit_date, d.retailer_id))
            if matching_col and matching_col.store:
                store_name = matching_col.store.store_name
        
        tx_store_name = store_name or retailer_name

        if d.deposit_type == "portal":
            tx_type = "credit" # You Got
            amount = float(d.amount)
            if d.payment_mode == "online":
                desc_text = f"Online Payment from {tx_store_name}" if tx_store_name else "Online Payment"
            else:
                desc_text = f"Cash Deposit from {tx_store_name}" if tx_store_name else "Cash Deposit"
            if fallback_remarks:
                desc_text += f" ({fallback_remarks})"
        elif d.deposit_type == "virtual":
            if d.payment_mode == "refund":
                tx_type = "credit" # You Got
                amount = float(d.amount)
                desc_text = f"Virtual Refund from {tx_store_name}" if tx_store_name else "Virtual Refund"
            else:
                tx_type = "debit" # You Gave
                amount = float(d.amount)
                desc_text = f"Virtual Transfer to {tx_store_name}" if tx_store_name else "Virtual Transfer"
            if fallback_remarks:
                desc_text += f" ({fallback_remarks})"
        elif d.deposit_type == "portal_transfer":
            # For portal_transfer: credit if this portal is destination, debit if this portal is source
            if str(d.portal_id) == str(portal_id):
                # This portal is the destination: it received money (credit)
                tx_type = "credit"
                src_name = d.from_portal.group.name if (d.from_portal and d.from_portal.group) else (d.from_portal.portal_name if d.from_portal else "Source Portal")
                desc_text = f"Transfer received from {src_name}"
            else:
                # This portal is the source: it sent money (debit)
                tx_type = "debit"
                dst_name = d.portal.group.name if (d.portal and d.portal.group) else (d.portal.portal_name if d.portal else "Destination Portal")
                desc_text = f"Transfer sent to {dst_name}"
            amount = float(d.amount)
            if fallback_remarks:
                desc_text += f" ({fallback_remarks})"
        else:
            continue
            
        denom_dict = None
        if d.denominations:
            denom_dict = {
                "note_500": int(d.denominations.note_500 or 0),
                "note_200": int(d.denominations.note_200 or 0),
                "note_100": int(d.denominations.note_100 or 0),
                "note_50": int(d.denominations.note_50 or 0),
                "note_20": int(d.denominations.note_20 or 0),
                "note_10": int(d.denominations.note_10 or 0),
                "coins": float(d.denominations.coins or 0.0),
                "online_amount": float(d.denominations.online_amount or 0.0)
            }
            
        tx_list.append({
            "id": str(d.id),
            "created_at": d.created_at,
            "transaction_type": tx_type,
            "amount": amount,
            "description": desc_text,
            "collection_id": None,
            "deposit_id": str(d.id),
            "remarks": fallback_remarks,
            "reference_no": d.reference_no,
            "deposit_type": d.deposit_type,
            "payment_mode": d.payment_mode,
            "recipient_staff_id": str(d.recipient_staff_id) if d.recipient_staff_id else None,
            "to_office": d.to_office,
            "retailer_id": str(d.retailer_id) if d.retailer_id else None,
            "store_id": None,
            "store_name": tx_store_name,
            "portal_id": str(d.portal_id) if d.portal_id else None,
            "denominations": denom_dict
        })

    for c in collections:
        # Collection associated with portal (normally cash collection associated with portal)
        denom_dict = None
        if c.denominations:
            denom_dict = {
                "note_500": int(c.denominations.note_500 or 0),
                "note_200": int(c.denominations.note_200 or 0),
                "note_100": int(c.denominations.note_100 or 0),
                "note_50": int(c.denominations.note_50 or 0),
                "note_20": int(c.denominations.note_20 or 0),
                "note_10": int(c.denominations.note_10 or 0),
                "coins": float(c.denominations.coins or 0.0),
                "online_amount": float(c.denominations.online_amount or 0.0)
            }
            
        tx_list.append({
            "id": str(c.id),
            "created_at": c.created_at,
            "transaction_type": "debit", # You Gave (decreases portal balance)
            "amount": float(c.total_amount),
            "description": f"Collection from {c.retailer.retailer_name if c.retailer else 'Retailer'}" + (f" ({c.remarks})" if c.remarks else ""),
            "collection_id": str(c.id),
            "deposit_id": None,
            "remarks": c.remarks,
            "reference_no": None,
            "deposit_type": None,
            "payment_mode": "cash",
            "recipient_staff_id": None,
            "to_office": c.from_office,
            "retailer_id": str(c.retailer_id) if c.retailer_id else None,
            "store_id": str(c.store_id) if c.store_id else None,
            "store_name": c.store.store_name if (c.store and c.store.store_name) else (c.retailer.retailer_name if c.retailer else None),
            "portal_id": str(c.portal_id) if c.portal_id else None,
            "denominations": denom_dict
        })

    # Sort transactions by created_at ascending to calculate running balance
    tx_list.sort(key=lambda x: x["created_at"])

    # Calculate running balance safely handling None values
    opening_take = portal.opening_to_take or Decimal("0.00")
    opening_give = portal.opening_to_give or Decimal("0.00")
    running_balance = float(opening_take - opening_give)
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
            "description": tx["description"],
            "collection_id": tx["collection_id"],
            "deposit_id": tx["deposit_id"],
            "remarks": tx["remarks"],
            "reference_no": tx["reference_no"],
            "deposit_type": tx["deposit_type"],
            "payment_mode": tx["payment_mode"],
            "recipient_staff_id": tx["recipient_staff_id"],
            "to_office": tx["to_office"],
            "retailer_id": tx["retailer_id"],
            "store_id": tx["store_id"],
            "store_name": tx.get("store_name"),
            "portal_id": tx["portal_id"],
            "denominations": tx["denominations"]
        })

    return {
        "portal_name": portal.portal_name,
        "group_name": portal.group.name if portal.group else None,
        "bank_name": portal.bank_name,
        "bank_account_no": portal.bank_account_no,
        "ifsc_code": portal.ifsc_code,
        "outstanding_balance": float(portal.balance or Decimal("0.00")),
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
        .options(joinedload(BankDeposit.retailer), joinedload(BankDeposit.portal), joinedload(BankDeposit.denominations))
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
        .options(joinedload(Collection.retailer), joinedload(Collection.portal), joinedload(Collection.denominations), joinedload(Collection.store))
        .where(
            and_(
                Collection.portal_id.in_(portal_ids),
                Collection.status == "verified",
                Collection.retailer_id == None
            )
        )
    ).all()
    
    from app.database.models import Store
    
    # Fetch all verified collections for these portals
    all_portal_cols = db.scalars(
        select(Collection)
        .options(joinedload(Collection.retailer), joinedload(Collection.store))
        .where(
            and_(
                Collection.portal_id.in_(portal_ids),
                Collection.status == "verified"
            )
        )
    ).all()
    
    # Group collections by (portal_id, date, retailer_id) and (portal_id, date). Multiple
    # collections can share the same (portal, date) with no retailer_id, so keep all of
    # them per key instead of letting one silently overwrite the rest.
    col_by_portal_date_retailer = {}
    # Keyed by date only (not portal_id): if a deposit is later edited to move
    # it to a different portal within the same group, this fallback match
    # must still find the collection that originally generated it — the
    # collection's own portal_id doesn't change just because the deposit's did.
    col_by_portal_date = {}
    for col in sorted(all_portal_cols, key=lambda c: c.created_at):
        k_triple = (col.collection_date, col.retailer_id)
        k_date = col.collection_date
        if col.retailer_id:
            col_by_portal_date_retailer[k_triple] = col
        col_by_portal_date.setdefault(k_date, []).append(col)

    def _best_portal_date_match(col_date, deposit_amount):
        candidates = col_by_portal_date.get(col_date) or []
        if not candidates:
            return None
        for c in candidates:
            online_amt = c.denominations.online_amount if c.denominations else None
            if online_amt is not None and Decimal(str(online_amt)) == Decimal(str(deposit_amount)):
                return c
        # No unambiguous amount match — only safe to guess when there's exactly one candidate.
        return candidates[0] if len(candidates) == 1 else None

    tx_list = []

    for d in deposits:
        retailer_name = d.retailer.retailer_name if d.retailer else None
        p_name = d.portal.portal_name if d.portal else "Account"

        # For online portal deposits without retailer, try to find the matching collection
        # to get store name (legacy data that didn't store retailer_id on the deposit)
        store_name = None
        fallback_remarks = d.remarks
        if d.deposit_type == "portal" and d.payment_mode == "online" and not retailer_name:
            matching_col = _best_portal_date_match(d.deposit_date, d.amount)
            if matching_col:
                retailer_name = matching_col.retailer.retailer_name if matching_col.retailer else None
                store_name = matching_col.store.store_name if matching_col.store else None
                if not fallback_remarks:
                    fallback_remarks = matching_col.remarks
        elif d.retailer:
            # If retailer is available, look up store from matching collection
            matching_col = col_by_portal_date_retailer.get((d.deposit_date, d.retailer_id))
            if matching_col and matching_col.store:
                store_name = matching_col.store.store_name
        
        tx_store_name = store_name or retailer_name

        prefix = f"[{p_name}] " if p_name.lower().strip() != "primary account" else ""
        if d.deposit_type == "portal":
            tx_type = "credit"
            amount = float(d.amount)
            if d.payment_mode == "online":
                desc_text = f"{prefix}Online Payment from {tx_store_name}" if tx_store_name else f"{prefix}Online Payment"
            else:
                desc_text = f"{prefix}Cash Deposit from {tx_store_name}" if tx_store_name else f"{prefix}Cash Deposit"
            if fallback_remarks:
                desc_text += f" ({fallback_remarks})"
        elif d.deposit_type == "virtual":
            if d.payment_mode == "refund":
                tx_type = "credit"
                amount = float(d.amount)
                desc_text = f"Virtual Refund from {tx_store_name}" if tx_store_name else "Virtual Refund"
            else:
                tx_type = "debit"
                amount = float(d.amount)
                desc_text = f"Virtual Transfer to {tx_store_name}" if tx_store_name else "Virtual Transfer"
            if fallback_remarks:
                desc_text += f" ({fallback_remarks})"
        else:
            continue
            
        denom_dict = None
        if d.denominations:
            denom_dict = {
                "note_500": int(d.denominations.note_500 or 0),
                "note_200": int(d.denominations.note_200 or 0),
                "note_100": int(d.denominations.note_100 or 0),
                "note_50": int(d.denominations.note_50 or 0),
                "note_20": int(d.denominations.note_20 or 0),
                "note_10": int(d.denominations.note_10 or 0),
                "coins": float(d.denominations.coins or 0.0),
                "online_amount": float(d.denominations.online_amount or 0.0)
            }

        tx_list.append({
            "id": str(d.id),
            "created_at": d.created_at,
            "transaction_type": tx_type,
            "amount": amount,
            "description": desc_text,
            "collection_id": None,
            "deposit_id": str(d.id),
            "remarks": fallback_remarks,
            "reference_no": d.reference_no,
            "deposit_type": d.deposit_type,
            "payment_mode": d.payment_mode,
            "recipient_staff_id": str(d.recipient_staff_id) if d.recipient_staff_id else None,
            "to_office": d.to_office,
            "retailer_id": str(d.retailer_id) if d.retailer_id else None,
            "store_id": None,
            "store_name": tx_store_name,
            "portal_id": str(d.portal_id) if d.portal_id else None,
            "denominations": denom_dict
        })
        
    for c in collections:
        p_name = c.portal.portal_name if c.portal else "Account"
        denom_dict = None
        if c.denominations:
            denom_dict = {
                "note_500": int(c.denominations.note_500 or 0),
                "note_200": int(c.denominations.note_200 or 0),
                "note_100": int(c.denominations.note_100 or 0),
                "note_50": int(c.denominations.note_50 or 0),
                "note_20": int(c.denominations.note_20 or 0),
                "note_10": int(c.denominations.note_10 or 0),
                "coins": float(c.denominations.coins or 0.0),
                "online_amount": float(c.denominations.online_amount or 0.0)
            }
        prefix = f"[{p_name}] " if p_name.lower().strip() != "primary account" else ""
        tx_list.append({
            "id": str(c.id),
            "created_at": c.created_at,
            "transaction_type": "debit",
            "amount": float(c.total_amount),
            "description": f"{prefix}Collection from {c.retailer.retailer_name if c.retailer else 'Retailer'}" + (f" ({c.remarks})" if c.remarks else ""),
            "collection_id": str(c.id),
            "deposit_id": None,
            "remarks": c.remarks,
            "reference_no": None,
            "deposit_type": None,
            "payment_mode": "cash",
            "recipient_staff_id": None,
            "to_office": c.from_office,
            "retailer_id": str(c.retailer_id) if c.retailer_id else None,
            "store_id": str(c.store_id) if c.store_id else None,
            "store_name": c.store.store_name if (c.store and c.store.store_name) else (c.retailer.retailer_name if c.retailer else None),
            "portal_id": str(c.portal_id) if c.portal_id else None,
            "denominations": denom_dict
        })
        
    tx_list.sort(key=lambda x: x["created_at"])
    
    # Calculate running balance safely handling None values
    opening_take = group.opening_to_take or Decimal("0.00")
    opening_give = group.opening_to_give or Decimal("0.00")
    running_balance = float(opening_take - opening_give)
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
            "description": tx["description"],
            "collection_id": tx["collection_id"],
            "deposit_id": tx["deposit_id"],
            "remarks": tx["remarks"],
            "reference_no": tx["reference_no"],
            "deposit_type": tx["deposit_type"],
            "payment_mode": tx["payment_mode"],
            "recipient_staff_id": tx["recipient_staff_id"],
            "to_office": tx["to_office"],
            "retailer_id": tx["retailer_id"],
            "store_id": tx["store_id"],
            "store_name": tx.get("store_name"),
            "portal_id": tx["portal_id"],
            "denominations": tx["denominations"]
        })
        
    return {
        "group_name": group.name,
        "outstanding_balance": float(group.balance or Decimal("0.00")),
        "statement_history": formatted_txs
    }
