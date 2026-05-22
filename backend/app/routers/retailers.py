import uuid
from typing import List
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.database.models import Retailer, User, Ledger, Store
from sqlalchemy import select, desc
from app.schemas.retailer import RetailerCreate, RetailerUpdate, RetailerResponse, StoreCreate, StoreResponse
from app.dependencies import require_admin, require_any_user

router = APIRouter(prefix="/retailers", tags=["Retailers Directory"])


@router.post("", response_model=RetailerResponse, status_code=status.HTTP_201_CREATED)
def create_retailer(
    retailer_data: RetailerCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Admin-only endpoint to register retailers."""
    # Verify staff id exists if provided
    if retailer_data.assigned_staff_id:
        staff = db.scalar(select(User).where(User.id == retailer_data.assigned_staff_id))
        if not staff:
            raise HTTPException(status_code=400, detail="Assigned staff member not found")

    db_retailer = Retailer(
        retailer_name=retailer_data.retailer_name,
        address=retailer_data.address,
        assigned_staff_id=retailer_data.assigned_staff_id,
        email=retailer_data.email,
        phone=retailer_data.phone,
        opening_to_give=retailer_data.opening_to_give,
        opening_to_take=retailer_data.opening_to_take
    )
    db.add(db_retailer)
    db.flush() # Get ID before commit

    # Calculate net initial balance
    # To Take (Debit) is positive, To Give (Credit) is negative
    net_balance = retailer_data.opening_to_take - retailer_data.opening_to_give

    # Create initial ledger entry if net balance is non-zero
    if net_balance != 0:
        initial_ledger = Ledger(
            retailer_id=db_retailer.id,
            transaction_type="debit" if net_balance > 0 else "credit",
            amount=abs(net_balance),
            balance=net_balance,
            description="Opening Balance"
        )
        db.add(initial_ledger)

    db.commit()
    db.refresh(db_retailer)
    db_retailer.balance = float(net_balance)
    return db_retailer


@router.get("", response_model=List[RetailerResponse])
def list_retailers(
    db: Session = Depends(get_db),
    current_user=Depends(require_any_user)
):
    """Get active retailers. All users can see all retailers for now."""
    retailers = db.scalars(select(Retailer).order_by(Retailer.retailer_name)).all()
    
    # Manually calculate balance for each retailer from the latest ledger entry
    for ret in retailers:
        latest_ledger = db.scalar(
            select(Ledger)
            .where(Ledger.retailer_id == ret.id)
            .order_by(desc(Ledger.created_at))
            .limit(1)
        )
        ret.balance = float(latest_ledger.balance) if latest_ledger else 0.00
        
    return retailers


@router.put("/{retailer_id}", response_model=RetailerResponse)
def update_retailer(
    retailer_id: uuid.UUID,
    retailer_data: RetailerUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Admin-only endpoint to update retailer information and staff assignments."""
    retailer = db.scalar(select(Retailer).where(Retailer.id == retailer_id))
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")

    # Update fields
    for field, value in retailer_data.model_dump(exclude_unset=True).items():
        if field == "assigned_staff_id" and value:
            staff = db.scalar(select(User).where(User.id == value))
            if not staff:
                raise HTTPException(status_code=400, detail="Assigned staff member not found")
        if field in ["opening_to_give", "opening_to_take"] and value is not None:
            from decimal import Decimal
            value = Decimal(str(value))
        setattr(retailer, field, value)

    db.commit()
    
    # Recalculate ledger balances in case opening balances were changed
    from app.logic.ledger import recalculate_balances
    recalculate_balances(retailer_id, db)
    db.commit()
    
    db.refresh(retailer)
    return retailer


@router.delete("/{retailer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_retailer(
    retailer_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Admin-only endpoint to remove a retailer."""
    retailer = db.scalar(select(Retailer).where(Retailer.id == retailer_id))
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")

    db.delete(retailer)
    db.commit()
    return None


@router.post("/{retailer_id}/stores", response_model=StoreResponse, status_code=status.HTTP_201_CREATED)
def create_store(
    retailer_id: uuid.UUID,
    store_data: StoreCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Admin-only endpoint to register stores under a retailer."""
    retailer = db.scalar(select(Retailer).where(Retailer.id == retailer_id))
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")

    db_store = Store(
        retailer_id=retailer_id,
        store_name=store_data.store_name,
        address=store_data.address,
        phone=store_data.phone
    )
    db.add(db_store)
    db.commit()
    db.refresh(db_store)
    return db_store


@router.get("/{retailer_id}/stores", response_model=List[StoreResponse])
def list_stores(
    retailer_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_any_user)
):
    """Get all stores under a specific retailer."""
    retailer = db.scalar(select(Retailer).where(Retailer.id == retailer_id))
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")

    stores = db.scalars(select(Store).where(Store.retailer_id == retailer_id).order_by(Store.store_name)).all()
    return stores


@router.put("/{retailer_id}/stores/{store_id}", response_model=StoreResponse)
def update_store(
    retailer_id: uuid.UUID,
    store_id: uuid.UUID,
    store_data: StoreCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Admin-only endpoint to update a store under a retailer."""
    store = db.scalar(select(Store).where(Store.id == store_id, Store.retailer_id == retailer_id))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    for field, value in store_data.model_dump(exclude_unset=True).items():
        setattr(store, field, value)

    db.commit()
    db.refresh(store)
    return store


@router.delete("/{retailer_id}/stores/{store_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_store(
    retailer_id: uuid.UUID,
    store_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Admin-only endpoint to delete a store under a retailer."""
    store = db.scalar(select(Store).where(Store.id == store_id, Store.retailer_id == retailer_id))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    db.delete(store)
    db.commit()
    return None
