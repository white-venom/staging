import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_, desc
from sqlalchemy.orm import Session, joinedload

from app.database.db import get_db
from app.database.models import BankDeposit, Denomination, Portal, Retailer, User, Ledger
from app.logic.ledger import recalculate_balances
from sqlalchemy import update, delete
from decimal import Decimal
from app.schemas.deposit import DepositCreate, DepositResponse
from app.dependencies import require_staff, require_admin, require_any_user

router = APIRouter(prefix="/bank-deposits", tags=["Deposits & Payouts Tracking"])


@router.post("", response_model=DepositResponse, status_code=status.HTTP_201_CREATED)
def submit_deposit(
    payload: DepositCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_staff)
):
    """Staff registers a deposit: Option A (Portal bank), Option B (Retailer payout), or Option C (Staff handover)."""
    # Validation checks
    dt = payload.deposit_type.lower().strip()
    if dt == "portal":
        portal = db.scalar(select(Portal).where(Portal.id == payload.portal_id))
        if not portal:
            raise HTTPException(status_code=404, detail="Target portal bank account not found.")
    elif dt == "retailer":
        retailer = db.scalar(select(Retailer).where(Retailer.id == payload.retailer_id))
        if not retailer:
            raise HTTPException(status_code=404, detail="Target retailer profile not found.")
    elif dt == "staff":
        if payload.recipient_staff_id:
            recipient = db.scalar(select(User).where(User.id == payload.recipient_staff_id))
            if not recipient:
                raise HTTPException(status_code=404, detail="Recipient staff member not found.")

    try:
        db_deposit = BankDeposit(
            staff_id=current_user.id,
            deposit_type=dt,
            portal_id=payload.portal_id,
            retailer_id=payload.retailer_id,
            recipient_staff_id=payload.recipient_staff_id,
            to_office=payload.to_office,
            payment_mode=payload.payment_mode,
            amount=payload.amount,
            deposit_date=payload.deposit_date,
            reference_no=payload.reference_no,
            status="verified"
        )
        db.add(db_deposit)
        db.flush()

        # If cash denominations are provided, save them
        if payload.denominations:
            d = payload.denominations
            db_denom = Denomination(
                deposit_id=db_deposit.id,
                note_500=d.note_500,
                note_200=d.note_200,
                note_100=d.note_100,
                note_50=d.note_50,
                note_20=d.note_20,
                note_10=d.note_10,
                coins=d.coins,
                online_amount=d.online_amount
            )
            db.add(db_denom)

        # 2. IMMEDIATE Ledger Bookkeeping
        if dt == "retailer":
            latest_ledger = db.scalar(
                select(Ledger)
                .where(Ledger.retailer_id == payload.retailer_id)
                .order_by(desc(Ledger.created_at))
                .limit(1)
            )
            
            if latest_ledger:
                prev_balance = latest_ledger.balance
            else:
                prev_balance = Decimal(str(retailer.opening_to_take or 0)) - Decimal(str(retailer.opening_to_give or 0))
            
            # Deposits/Payouts to retailer (Debit) increase what they owe DO IT SERVICES
            new_balance = prev_balance + payload.amount

            ledger_entry = Ledger(
                retailer_id=payload.retailer_id,
                transaction_type="debit",
                amount=payload.amount,
                balance=new_balance,
                description="cash payout (auto-verified)",
                deposit_id=db_deposit.id
            )
            db.add(ledger_entry)
            
            # UPDATE RETAILER BALANCE FIELD
            retailer.balance = new_balance
            db_deposit.balance_snapshot = new_balance
        
        elif dt == "portal":
            # Portal deposits reduce what DO IT SERVICES owes to the portal group
            # Assets increase (from DO IT perspective, we have less cash but less debt)
            # Actually, PortalGroup.balance = Assets - Liabilities.
            # Depositing money to them increases the balance (closer to zero if negative).
            if portal:
                # Update individual portal balance
                portal.balance += Decimal(str(payload.amount))
                db_deposit.balance_snapshot = portal.balance
                
                # Also update group balance
                if portal.group:
                    portal.group.balance += Decimal(str(payload.amount))

        db.commit()
        db.refresh(db_deposit)
        
        # Populate target_name for response
        if dt == "portal":
            portal = db.scalar(select(Portal).where(Portal.id == payload.portal_id))
            if portal:
                db_deposit.target_name = portal.portal_name
                if portal.group:
                    db_deposit.portal_group_name = portal.group.name
                    db_deposit.portal_group_id = portal.group.id
            else:
                db_deposit.target_name = "Portal Bank"
        elif dt == "retailer":
            retailer = db.scalar(select(Retailer).where(Retailer.id == payload.retailer_id))
            db_deposit.target_name = retailer.retailer_name if retailer else "Retailer Store"
        elif dt == "staff":
            if payload.to_office:
                db_deposit.target_name = "Main Office Cashier"
            else:
                if payload.recipient_staff_id:
                    recipient = db.scalar(select(User).where(User.id == payload.recipient_staff_id))
                    db_deposit.target_name = recipient.name if recipient else "Field Staff"
                else:
                    db_deposit.target_name = "Field Staff"
        
        db_deposit.staff_name = current_user.name
        
        return db_deposit
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to record deposit: {str(e)}")


@router.get("", response_model=List[DepositResponse])
def list_deposits(
    deposit_type: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_any_user)
):
    """List deposit records. Staff is restricted to viewing only their own entries; Admins see all."""
    query = select(BankDeposit)
    if current_user.role != "admin":
        query = query.where(BankDeposit.staff_id == current_user.id)

    filters = []
    if deposit_type:
        filters.append(BankDeposit.deposit_type == deposit_type)
    if status:
        filters.append(BankDeposit.status == status)

    if filters:
        query = query.where(and_(*filters))

    query = query.options(
        joinedload(BankDeposit.portal),
        joinedload(BankDeposit.retailer),
        joinedload(BankDeposit.recipient_staff),
        joinedload(BankDeposit.staff)
    )
    deposits = db.scalars(query.order_by(desc(BankDeposit.created_at))).all()
    
    # Manually populate target_name
    for dep in deposits:
        if dep.deposit_type == "portal":
            dep.target_name = dep.portal.portal_name if dep.portal else "Portal Bank"
            if dep.portal and dep.portal.group:
                dep.portal_group_name = dep.portal.group.name
                dep.portal_group_id = dep.portal.group.id
        elif dep.deposit_type == "retailer":
            dep.target_name = dep.retailer.retailer_name if dep.retailer else "Retailer Store"
        elif dep.deposit_type == "staff":
            if dep.to_office:
                dep.target_name = "Main Office Cashier"
            else:
                dep.target_name = dep.recipient_staff.name if dep.recipient_staff else "Field Staff"
        else:
            dep.target_name = "Direct Deposit"
            
        dep.staff_name = dep.staff.name if dep.staff else "System"

    return deposits


@router.put("/{deposit_id}/verify", response_model=DepositResponse)
def verify_deposit(
    deposit_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Admin verifies cash/online deposits, marking them verified and logging their verifier ID."""
    deposit = db.scalar(select(BankDeposit).where(BankDeposit.id == deposit_id))
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit record not found.")

    if deposit.status == "verified":
        raise HTTPException(status_code=400, detail="This deposit record has already been verified.")

    deposit.status = "verified"
    deposit.verified_by = current_user.id
    db.commit()
    db.refresh(deposit)
    return deposit

@router.delete("/{deposit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deposit(
    deposit_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Admin-only: Delete a deposit and its associated ledger entry, then fix following balances."""
    deposit = db.scalar(select(BankDeposit).where(BankDeposit.id == deposit_id))
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit record not found")
    
    retailer_id = deposit.retailer_id
    
    # Delete associated ledger entries
    db.execute(delete(Ledger).where(Ledger.deposit_id == deposit_id))
    
    # Handle Portal balance reversal if it was a portal deposit
    if deposit.deposit_type == "portal" and deposit.portal_id:
        portal = db.scalar(select(Portal).where(Portal.id == deposit.portal_id))
        if portal:
            portal.balance -= Decimal(str(deposit.amount))
            if portal.group:
                portal.group.balance -= Decimal(str(deposit.amount))
    
    db.delete(deposit)
    db.commit()
    
    # Recalculate balances if it was a retailer deposit
    if retailer_id:
        recalculate_balances(retailer_id, db)
        db.commit()
        
    return None
