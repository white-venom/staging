import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy import select, and_, or_, desc
from sqlalchemy.orm import Session, joinedload, selectinload

from app.database.db import get_db
from app.database.models import BankDeposit, Denomination, Portal, PortalGroup, Retailer, User, Ledger
from app.logic.ledger import recalculate_balances
from sqlalchemy import update, delete
from decimal import Decimal
from app.schemas.deposit import DepositCreate, DepositResponse
from app.dependencies import require_staff, require_admin, require_any_user

router = APIRouter(prefix="/bank-deposits", tags=["Deposits & Payouts Tracking"])


@router.post("", response_model=DepositResponse, status_code=status.HTTP_201_CREATED)
def submit_deposit(
    payload: DepositCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(require_staff)
):
    """Staff registers a deposit: Option A (Portal bank), Option B (Retailer payout), or Option C (Staff handover)."""
    # Validation checks
    dt = payload.deposit_type.lower().strip()
    portal = None
    retailer = None
    if dt == "portal":
        portal = db.scalar(select(Portal).where(Portal.id == payload.portal_id).with_for_update())
        if not portal:
            raise HTTPException(status_code=404, detail="Target portal bank account not found.")
    elif dt == "retailer":
        retailer = db.scalar(select(Retailer).where(Retailer.id == payload.retailer_id).with_for_update())
        if not retailer:
            raise HTTPException(status_code=404, detail="Target retailer profile not found.")
    elif dt == "staff":
        if payload.recipient_staff_id:
            recipient = db.scalar(select(User).where(User.id == payload.recipient_staff_id).with_for_update())
            if not recipient:
                raise HTTPException(status_code=404, detail="Recipient staff member not found.")
    elif dt == "virtual":
        if current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators are authorized to process virtual transfers."
            )
        portal = db.scalar(select(Portal).where(Portal.id == payload.portal_id).with_for_update())
        if not portal:
            raise HTTPException(status_code=404, detail="Source portal bank/wallet account not found.")
        retailer = db.scalar(select(Retailer).where(Retailer.id == payload.retailer_id).with_for_update())
        if not retailer:
            raise HTTPException(status_code=404, detail="Target retailer not found.")

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
                .order_by(desc(Ledger.created_at), desc(Ledger.id))
                .limit(1)
            )
            
            if latest_ledger:
                prev_balance = latest_ledger.balance
            else:
                prev_balance = Decimal(str(retailer.opening_to_take or 0))
            
            # Deposits/Payouts to retailer (Debit) increase what they owe DO IT SERVICES
            new_balance = prev_balance + payload.amount

            ledger_entry = Ledger(
                retailer_id=payload.retailer_id,
                transaction_type="debit",
                amount=payload.amount,
                balance=new_balance,
                description="cash out",
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
        elif dt == "virtual":
            # Admin does not have a virtual balance limit to validate/decrement.
            pass

            # Step A: Decrement Portal Balance and To Give
            portal.balance -= payload.amount
            portal.opening_to_give = (portal.opening_to_give or Decimal("0.00")) + payload.amount
            if portal.group:
                portal.group.balance -= payload.amount
                portal.group.opening_to_give = (portal.group.opening_to_give or Decimal("0.00")) + payload.amount
                
            # Step B: Fetch latest ledger entry to calculate new running balance
            latest_ledger = db.scalar(
                select(Ledger)
                .where(Ledger.retailer_id == payload.retailer_id)
                .order_by(desc(Ledger.created_at), desc(Ledger.id))
                .limit(1)
            )
            
            if latest_ledger:
                prev_balance = latest_ledger.balance
            else:
                prev_balance = Decimal(str(retailer.opening_to_take or 0))
                
            new_balance = prev_balance + payload.amount
            
            # Step C: Log a 'debit' entry in Retailer's Ledger
            desc_text = "virtual transfer"
                
            ledger_entry = Ledger(
                retailer_id=payload.retailer_id,
                transaction_type="debit",
                amount=payload.amount,
                balance=new_balance,
                description=desc_text,
                deposit_id=db_deposit.id
            )
            db.add(ledger_entry)
            
            # Step D: Update retailer outstanding balance cache
            retailer.balance = new_balance
            db_deposit.balance_snapshot = new_balance

        db.commit()
        db.refresh(db_deposit)
        
        # Populate target_name for response
        if dt == "portal":
            portal = db.scalar(select(Portal).where(Portal.id == payload.portal_id).with_for_update())
            if portal:
                db_deposit.target_name = portal.portal_name
                if portal.group:
                    db_deposit.portal_group_name = portal.group.name
                    db_deposit.portal_group_id = portal.group.id
            else:
                db_deposit.target_name = "Portal Bank"
        elif dt == "retailer":
            retailer = db.scalar(select(Retailer).where(Retailer.id == payload.retailer_id).with_for_update())
            db_deposit.target_name = retailer.retailer_name if retailer else "Retailer Store"
            if retailer:
                db_deposit.retailer_ledger_token = retailer.ledger_token
        elif dt == "staff":
            if payload.to_office:
                db_deposit.target_name = "Main Office Cashier"
            else:
                if payload.recipient_staff_id:
                    recipient = db.scalar(select(User).where(User.id == payload.recipient_staff_id).with_for_update())
                    db_deposit.target_name = recipient.name if recipient else "Field Staff"
                else:
                    db_deposit.target_name = "Field Staff"
        elif dt == "virtual":
            portal = db.scalar(select(Portal).where(Portal.id == payload.portal_id).with_for_update())
            retailer = db.scalar(select(Retailer).where(Retailer.id == payload.retailer_id).with_for_update())
            p_name = portal.portal_name if portal else "Portal"
            r_name = retailer.retailer_name if retailer else "Retailer"
            db_deposit.target_name = f"Virtual: {p_name} ➔ {r_name}"
            if retailer:
                db_deposit.retailer_ledger_token = retailer.ledger_token
            if portal and portal.group:
                db_deposit.portal_group_name = portal.group.name
                db_deposit.portal_group_id = portal.group.id
        
        db_deposit.staff_name = current_user.name
        
        # Trigger WhatsApp message asynchronously for payouts to retailer
        if dt in ["retailer", "virtual"] and retailer and retailer.phone:
            try:
                import os
                from app.services.whatsapp import send_whatsapp_message
                frontend_url = os.getenv("FRONTEND_BASE_URL", "https://doitservice.com")
                secure_link = f"{frontend_url}/public/ledger/{retailer.ledger_token}"
                background_tasks.add_task(
                    send_whatsapp_message,
                    to_phone_number=retailer.phone,
                    template_name="retailer_deposit_receipt",
                    variables=[retailer.retailer_name, str(payload.amount), secure_link]
                )
            except Exception as whatsapp_err:
                print(f"Error queueing WhatsApp message for deposit: {whatsapp_err}")
        
        return db_deposit
    except Exception as e:
        db.rollback()
        print(f"Error recording deposit: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred while processing the deposit.")


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
        query = query.where(
            or_(
                BankDeposit.staff_id == current_user.id,
                and_(
                    BankDeposit.recipient_staff_id == current_user.id,
                    BankDeposit.deposit_type == "staff"
                )
            )
        )

    filters = []
    if deposit_type:
        filters.append(BankDeposit.deposit_type == deposit_type)
    if status:
        filters.append(BankDeposit.status == status)

    if filters:
        query = query.where(and_(*filters))

    query = query.options(
        joinedload(BankDeposit.portal).joinedload(Portal.group),
        joinedload(BankDeposit.retailer),
        joinedload(BankDeposit.recipient_staff),
        joinedload(BankDeposit.staff),
        selectinload(BankDeposit.ledgers)
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
            if dep.retailer:
                dep.retailer_ledger_token = dep.retailer.ledger_token
        elif dep.deposit_type == "staff":
            if dep.to_office:
                dep.target_name = "Main Office Cashier"
            else:
                if current_user.role != "admin" and dep.recipient_staff_id == current_user.id:
                    dep.target_name = f"Received from {dep.staff.name if dep.staff else 'Staff'}"
                else:
                    dep.target_name = dep.recipient_staff.name if dep.recipient_staff else "Field Staff"
        elif dep.deposit_type == "virtual":
            portal_obj = dep.portal
            if dep.retailer:
                dep.target_name = f"Retailer Limit: {dep.retailer.retailer_name}"
                dep.retailer_ledger_token = dep.retailer.ledger_token
            elif dep.recipient_staff:
                dep.target_name = f"Staff Limit: {dep.recipient_staff.name}"
            else:
                dep.target_name = "Virtual Transfer"
            # Set portal name for narration
            dep.portal_name = portal_obj.portal_name if portal_obj else "Portal"
            if portal_obj and portal_obj.group:
                dep.portal_group_name = portal_obj.group.name
                dep.portal_group_id = portal_obj.group.id
            # Determine direction and use linked ledger for accurate balance
            is_ref = (dep.payment_mode == "refund")
            if dep.ledgers:
                is_ref = is_ref or any(le.transaction_type == "credit" or "refund" in (le.description or "").lower() for le in dep.ledgers if le is not None)
            
            dep.is_refund = is_ref
            linked_ledger = next((le for le in dep.ledgers if le is not None), None)
            if linked_ledger:
                dep.balance_snapshot = linked_ledger.balance  # Always use recalculated balance
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
    current_user=Depends(require_any_user)
):
    """Admin or Staff (within 5 mins): Delete a deposit and its associated ledger entry, then fix following balances."""
    deposit = db.scalar(select(BankDeposit).where(BankDeposit.id == deposit_id).with_for_update())
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit record not found")
        
    if current_user.role != "admin":
        if deposit.deposit_type == "virtual":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators are authorized to process virtual transfers."
            )
        if deposit.staff_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this deposit")
        # Check if within 5 minutes
        if datetime.utcnow() - deposit.created_at > timedelta(minutes=5):
            raise HTTPException(status_code=403, detail="Can only delete deposits within 5 minutes of creation")
    
    retailer_id = deposit.retailer_id
    
    # Delete associated ledger entries
    db.execute(delete(Ledger).where(Ledger.deposit_id == deposit_id))
    
    # Handle Portal and Staff balance reversals
    if deposit.portal_id:
        portal = db.scalar(select(Portal).where(Portal.id == deposit.portal_id).with_for_update())
        if portal:
            if deposit.deposit_type == "portal":
                # Deleting portal deposit: reduce portal balance since cash was never deposited
                portal.balance -= Decimal(str(deposit.amount))
                if portal.group:
                    portal.group.balance -= Decimal(str(deposit.amount))
            elif deposit.deposit_type == "virtual":
                # Deleting virtual transfer: restore/revert portal balance
                if deposit.payment_mode == "refund":
                    # Deleting virtual refund: decrease portal balance since refund is reverted
                    portal.balance -= Decimal(str(deposit.amount))
                    portal.opening_to_give = (portal.opening_to_give or Decimal("0.00")) + Decimal(str(deposit.amount))
                    if portal.group:
                        portal.group.balance -= Decimal(str(deposit.amount))
                        portal.group.opening_to_give = (portal.group.opening_to_give or Decimal("0.00")) + Decimal(str(deposit.amount))
                else:
                    # Deleting virtual load: increase portal balance since load is reverted
                    portal.balance += Decimal(str(deposit.amount))
                    portal.opening_to_give = (portal.opening_to_give or Decimal("0.00")) - Decimal(str(deposit.amount))
                    if portal.group:
                        portal.group.balance += Decimal(str(deposit.amount))
                        portal.group.opening_to_give = (portal.group.opening_to_give or Decimal("0.00")) - Decimal(str(deposit.amount))

    # Reverse staff virtual limit if virtual limit transfer is deleted
    if deposit.deposit_type == "virtual":
        if deposit.recipient_staff_id:
            # Reversing virtual transfer to staff: adjust recipient's limit
            recipient = db.scalar(select(User).where(User.id == deposit.recipient_staff_id).with_for_update())
            if recipient:
                if deposit.payment_mode == "refund":
                    recipient.virtual_balance += Decimal(str(deposit.amount))
                else:
                    recipient.virtual_balance -= Decimal(str(deposit.amount))
        else:
            # Reversing portal-to-retailer transfer: refund creator's limit if they are staff
            creator = db.scalar(select(User).where(User.id == deposit.staff_id).with_for_update())
            if creator and creator.role != "admin":
                if deposit.payment_mode == "refund":
                    creator.virtual_balance -= Decimal(str(deposit.amount))
                else:
                    creator.virtual_balance += Decimal(str(deposit.amount))
    
    db.delete(deposit)
    db.commit()
    
    # Recalculate balances if it was a retailer deposit
    if retailer_id:
        recalculate_balances(retailer_id, db)
        db.commit()
        
    return None

@router.put("/{deposit_id}", response_model=DepositResponse)
def update_deposit(
    deposit_id: uuid.UUID,
    payload: DepositCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_any_user)
):
    """Admin or Staff (within 5 mins): Update a deposit by reversing the old one and applying the new one."""
    deposit = db.scalar(select(BankDeposit).where(BankDeposit.id == deposit_id).with_for_update())
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit record not found")
        
    if current_user.role != "admin":
        if deposit.deposit_type == "virtual" or payload.deposit_type.lower().strip() == "virtual":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators are authorized to process virtual transfers."
            )
        if deposit.staff_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to update this deposit")
        # Check if within 5 minutes
        if datetime.utcnow() - deposit.created_at > timedelta(minutes=5):
            raise HTTPException(status_code=403, detail="Can only update deposits within 5 minutes of creation")
            
    # For a full update, it's safest to rely on the delete logic to reverse balances, 
    # and then the submit logic to re-apply them. However, since the endpoint is PUT
    # and we want to keep the same ID and created_at, we will do it manually.
    
    # First, reverse old balances (similar to delete_deposit)
    if deposit.portal_id:
        portal = db.scalar(select(Portal).where(Portal.id == deposit.portal_id).with_for_update())
        if portal:
            if deposit.deposit_type == "portal":
                portal.balance -= Decimal(str(deposit.amount))
                if portal.group:
                    portal.group.balance -= Decimal(str(deposit.amount))
            elif deposit.deposit_type == "virtual":
                if deposit.payment_mode == "refund":
                    portal.balance -= Decimal(str(deposit.amount))
                    portal.opening_to_give = (portal.opening_to_give or Decimal("0.00")) + Decimal(str(deposit.amount))
                    if portal.group:
                        portal.group.balance -= Decimal(str(deposit.amount))
                        portal.group.opening_to_give = (portal.group.opening_to_give or Decimal("0.00")) + Decimal(str(deposit.amount))
                else:
                    portal.balance += Decimal(str(deposit.amount))
                    portal.opening_to_give = (portal.opening_to_give or Decimal("0.00")) - Decimal(str(deposit.amount))
                    if portal.group:
                        portal.group.balance += Decimal(str(deposit.amount))
                        portal.group.opening_to_give = (portal.group.opening_to_give or Decimal("0.00")) - Decimal(str(deposit.amount))

    if deposit.deposit_type == "virtual":
        if deposit.recipient_staff_id:
            recipient = db.scalar(select(User).where(User.id == deposit.recipient_staff_id).with_for_update())
            if recipient:
                if deposit.payment_mode == "refund":
                    recipient.virtual_balance += Decimal(str(deposit.amount))
                else:
                    recipient.virtual_balance -= Decimal(str(deposit.amount))
        else:
            creator = db.scalar(select(User).where(User.id == deposit.staff_id).with_for_update())
            if creator and creator.role != "admin":
                if deposit.payment_mode == "refund":
                    creator.virtual_balance -= Decimal(str(deposit.amount))
                else:
                    creator.virtual_balance += Decimal(str(deposit.amount))
    
    old_retailer_id = deposit.retailer_id
    
    for field, value in payload.model_dump(exclude_unset=True, exclude={"denominations"}).items():
        setattr(deposit, field, value)

    if payload.denominations:
        d = payload.denominations
        if deposit.denominations:
            deposit.denominations.note_500 = d.note_500
            deposit.denominations.note_200 = d.note_200
            deposit.denominations.note_100 = d.note_100
            deposit.denominations.note_50 = d.note_50
            deposit.denominations.note_20 = d.note_20
            deposit.denominations.note_10 = d.note_10
            deposit.denominations.coins = d.coins
            deposit.denominations.online_amount = d.online_amount
        else:
            db_denom = Denomination(
                deposit_id=deposit.id,
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
        
    # Re-apply new balances (similar to submit_deposit)
    dt = payload.deposit_type.lower().strip()
    if dt == "portal":
        portal = db.scalar(select(Portal).where(Portal.id == deposit.portal_id).with_for_update())
        if portal:
            portal.balance += Decimal(str(deposit.amount))
            if portal.group:
                portal.group.balance += Decimal(str(deposit.amount))
    elif dt == "virtual":
        portal = db.scalar(select(Portal).where(Portal.id == deposit.portal_id).with_for_update())
        if portal:
            if deposit.payment_mode == "refund":
                portal.balance += Decimal(str(deposit.amount))
                portal.opening_to_give = (portal.opening_to_give or Decimal("0.00")) - Decimal(str(deposit.amount))
                if portal.group:
                    portal.group.balance += Decimal(str(deposit.amount))
                    portal.group.opening_to_give = (portal.group.opening_to_give or Decimal("0.00")) - Decimal(str(deposit.amount))
            else:
                portal.balance -= Decimal(str(deposit.amount))
                portal.opening_to_give = (portal.opening_to_give or Decimal("0.00")) + Decimal(str(deposit.amount))
                if portal.group:
                    portal.group.balance -= Decimal(str(deposit.amount))
                    portal.group.opening_to_give = (portal.group.opening_to_give or Decimal("0.00")) + Decimal(str(deposit.amount))
        
        if payload.recipient_staff_id:
            recipient = db.scalar(select(User).where(User.id == payload.recipient_staff_id).with_for_update())
            if recipient:
                if payload.payment_mode == "refund":
                    recipient.virtual_balance -= Decimal(str(deposit.amount))
                else:
                    recipient.virtual_balance += Decimal(str(deposit.amount))
        else:
            creator = db.scalar(select(User).where(User.id == current_user.id).with_for_update())
            if creator and creator.role != "admin":
                if payload.payment_mode == "refund":
                    creator.virtual_balance += Decimal(str(deposit.amount))
                else:
                    creator.virtual_balance -= Decimal(str(deposit.amount))

    # Update ledger entry
    ledger_entry = db.scalar(select(Ledger).where(Ledger.deposit_id == deposit_id))
    if ledger_entry:
        ledger_entry.amount = payload.amount
        ledger_entry.portal_id = payload.portal_id
        ledger_entry.retailer_id = payload.retailer_id
        
    db.commit()
    
    # Recalculate retailer balances if changed
    if old_retailer_id:
        recalculate_balances(old_retailer_id, db)
    if deposit.retailer_id and deposit.retailer_id != old_retailer_id:
        recalculate_balances(deposit.retailer_id, db)
        
    db.commit()
    db.refresh(deposit)
    
    # Populate virtual fields
    deposit.staff_name = deposit.staff.name if deposit.staff else "Unknown"
    deposit.portal_name = deposit.portal.portal_name if deposit.portal else "Main Office"
    if deposit.portal and deposit.portal.group:
        deposit.portal_group_name = deposit.portal.group.name
        deposit.portal_group_id = deposit.portal.group.id
    deposit.is_refund = (deposit.payment_mode == "refund")
    
    if deposit.retailer_id and deposit.retailer:
        deposit.target_name = f"Retailer Limit: {deposit.retailer.retailer_name}" if deposit.deposit_type == "virtual" else deposit.retailer.retailer_name
        deposit.retailer_ledger_token = deposit.retailer.ledger_token
    elif deposit.recipient_staff_id and deposit.recipient_staff:
        deposit.target_name = f"Staff Limit: {deposit.recipient_staff.name}" if deposit.deposit_type == "virtual" else deposit.recipient_staff.name
    else:
        deposit.target_name = deposit.portal_name

    return deposit

