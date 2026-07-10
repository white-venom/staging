import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy import select, and_, or_, desc
from sqlalchemy.orm import Session, joinedload, selectinload

from app.database.db import get_db
from app.database.models import BankDeposit, Denomination, Portal, PortalGroup, Retailer, User, Ledger, BusinessSettings, Collection
from app.logic.ledger import recalculate_balances, lock_portal_group
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
    # Backdating gate: a non-admin may only pick a date other than today if
    # staff_can_change_collection_date is on. Reject with a clear error rather
    # than silently accepting an unintended backdate.
    from app.core.timezone import ist_today
    if current_user.role != "admin" and payload.deposit_date != ist_today():
        settings = db.scalar(select(BusinessSettings).where(BusinessSettings.id == 1))
        staff_can_change_date = getattr(settings, 'staff_can_change_collection_date', False) if settings else False
        if not staff_can_change_date:
            raise HTTPException(
                status_code=403,
                detail="Backdating deposits is disabled for staff. Ask an admin to enable it or submit with today's date."
            )

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
        portal = db.scalar(select(Portal).options(joinedload(Portal.group)).where(Portal.id == payload.portal_id).with_for_update())
        if not portal:
            raise HTTPException(status_code=404, detail="Source portal bank/wallet account not found.")
        retailer = db.scalar(select(Retailer).where(Retailer.id == payload.retailer_id).with_for_update())
        if not retailer:
            raise HTTPException(status_code=404, detail="Target retailer not found.")
    elif dt == "portal_transfer":
        if current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators are authorized to process portal-to-portal transfers."
            )
        portal = db.scalar(select(Portal).options(joinedload(Portal.group)).where(Portal.id == payload.portal_id).with_for_update())
        if not portal:
            raise HTTPException(status_code=404, detail="Destination portal not found.")
        from_portal = db.scalar(select(Portal).options(joinedload(Portal.group)).where(Portal.id == payload.from_portal_id).with_for_update())
        if not from_portal:
            raise HTTPException(status_code=404, detail="Source portal not found.")

    try:
        db_deposit = BankDeposit(
            staff_id=current_user.id,
            deposit_type=dt,
            portal_id=payload.portal_id,
            from_portal_id=payload.from_portal_id,
            retailer_id=payload.retailer_id,
            recipient_staff_id=payload.recipient_staff_id,
            to_office=payload.to_office,
            payment_mode=payload.payment_mode,
            amount=payload.amount,
            deposit_date=payload.deposit_date,
            reference_no=payload.reference_no,
            remarks=payload.remarks,
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
            
            # Raw signed running total: a payout is cash flowing OUT to the
            # retailer, the opposite direction from a collection, so it
            # subtracts from the same running total.
            new_balance = prev_balance - payload.amount

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
                lock_portal_group(db, portal)
                # Update individual portal balance
                portal.balance += Decimal(str(payload.amount))
                db_deposit.balance_snapshot = portal.balance

                # Also update group balance
                if portal.group:
                    portal.group.balance += Decimal(str(payload.amount))
        elif dt == "virtual":
            # Admin does not have a virtual balance limit to validate/decrement.
            lock_portal_group(db, portal)

            # Step A: Adjust Portal Balance
            if payload.payment_mode == "refund":
                portal.balance += payload.amount
                if portal.group:
                    portal.group.balance += payload.amount
            else:
                portal.balance -= payload.amount
                if portal.group:
                    portal.group.balance -= payload.amount
                
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
                
            # Raw signed running total, relabeled to match ledger.py's
            # credit=add/debit=subtract convention: a "load" moves money to
            # the retailer (same direction as a collection -> "credit", adds);
            # a "refund" reverses that, moving money back to the portal
            # (opposite direction -> "debit", subtracts).
            if payload.payment_mode == "refund":
                new_balance = prev_balance - payload.amount
                transaction_type = "debit"
                desc_text = "move to distributor"
            else:
                new_balance = prev_balance + payload.amount
                transaction_type = "credit"
                desc_text = portal.group.name if (portal and portal.group) else (portal.portal_name if portal else "virtual transfer")
            
            # Step C: Log entry in Retailer's Ledger
            ledger_entry = Ledger(
                retailer_id=payload.retailer_id,
                transaction_type=transaction_type,
                amount=payload.amount,
                balance=new_balance,
                description=desc_text,
                deposit_id=db_deposit.id
            )
            db.add(ledger_entry)
            
            # Step D: Update retailer outstanding balance cache
            retailer.balance = new_balance
            db_deposit.balance_snapshot = new_balance

        elif dt == "portal_transfer":
            # Deduct from source portal, add to destination portal
            lock_portal_group(db, from_portal)
            lock_portal_group(db, portal)
            from_portal.balance -= Decimal(str(payload.amount))
            if from_portal.group:
                from_portal.group.balance -= Decimal(str(payload.amount))
            portal.balance += Decimal(str(payload.amount))
            if portal.group:
                portal.group.balance += Decimal(str(payload.amount))
            db_deposit.balance_snapshot = portal.balance

        if dt in ["retailer", "virtual"] and payload.retailer_id:
            recalculate_balances(payload.retailer_id, db)
            # Sync the balance snapshot with the recalculated ledger balance
            ledger_entry = db.scalar(
                select(Ledger).where(Ledger.deposit_id == db_deposit.id)
            )
            if ledger_entry:
                db_deposit.balance_snapshot = ledger_entry.balance

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
            db_deposit.target_name = f"Virtual: {p_name} -> {r_name}"
            if retailer:
                db_deposit.retailer_ledger_token = retailer.ledger_token
            if portal and portal.group:
                db_deposit.portal_group_name = portal.group.name
                db_deposit.portal_group_id = portal.group.id
        elif dt == "portal_transfer":
            src = db.scalar(select(Portal).options(joinedload(Portal.group)).where(Portal.id == payload.from_portal_id))
            dst = db.scalar(select(Portal).options(joinedload(Portal.group)).where(Portal.id == payload.portal_id))
            src_name = (src.group.name if src and src.group else (src.portal_name if src else "Source Portal"))
            dst_name = (dst.group.name if dst and dst.group else (dst.portal_name if dst else "Dest Portal"))
            db_deposit.target_name = f"{src_name} → {dst_name}"
            if src and src.group:
                db_deposit.from_portal_name = src.group.name
                db_deposit.from_portal_group_name = src.group.name
            if dst and dst.group:
                db_deposit.portal_group_name = dst.group.name
                db_deposit.portal_group_id = dst.group.id
        
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
        joinedload(BankDeposit.from_portal).joinedload(Portal.group),
        joinedload(BankDeposit.retailer),
        joinedload(BankDeposit.recipient_staff),
        joinedload(BankDeposit.staff),
        joinedload(BankDeposit.denominations),
        selectinload(BankDeposit.ledgers)
    )
    deposits = db.scalars(query.order_by(desc(BankDeposit.created_at))).all()
    
    # Manually populate target_name
    for dep in deposits:
        if dep.deposit_type == "portal":
            dep.target_name = dep.portal.portal_name if dep.portal else "Portal Bank"
            dep.portal_name = dep.portal.portal_name if dep.portal else None
            dep.bank_name = dep.portal.bank_name if dep.portal else None
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
                dep.target_name = dep.retailer.retailer_name
                dep.retailer_ledger_token = dep.retailer.ledger_token
            elif dep.recipient_staff:
                dep.target_name = dep.recipient_staff.name
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
                is_ref = is_ref or any(le.transaction_type == "debit" or "refund" in (le.description or "").lower() for le in dep.ledgers if le is not None)
            
            dep.is_refund = is_ref
            linked_ledger = next((le for le in dep.ledgers if le is not None), None)
            if linked_ledger:
                dep.balance_snapshot = linked_ledger.balance  # Always use recalculated balance
        elif dep.deposit_type == "portal_transfer":
            src = dep.from_portal
            dst = dep.portal
            src_name = (src.group.name if src and src.group else (src.portal_name if src else "Source Portal"))
            dst_name = (dst.group.name if dst and dst.group else (dst.portal_name if dst else "Dest Portal"))
            dep.target_name = f"{src_name} → {dst_name}"
            if src and src.group:
                dep.from_portal_name = src.group.name
                dep.from_portal_group_name = src.group.name
            if dst and dst.group:
                dep.portal_group_name = dst.group.name
                dep.portal_group_id = dst.group.id
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
        # Check if within delete window
        settings = db.scalar(select(BusinessSettings).where(BusinessSettings.id == 1))
        delete_window = settings.delete_window_minutes if settings else 5
        if delete_window != -1:
            if datetime.utcnow() - deposit.created_at > timedelta(minutes=delete_window):
                raise HTTPException(status_code=403, detail=f"Can only delete deposits within {delete_window} minutes of creation")
    
    retailer_id = deposit.retailer_id
    if retailer_id:
        # Lock the retailer up front so the later recalculate_balances() call never
        # races with a concurrent request touching the same retailer's ledger.
        db.scalar(select(Retailer).where(Retailer.id == retailer_id).with_for_update())

    # Delete associated ledger entries
    db.execute(delete(Ledger).where(Ledger.deposit_id == deposit_id))

    # If this is an auto-generated staff-to-staff handover payout, also delete
    # the matching Collection on the recipient's side (and its ledger entries).
    # Collections.py's delete_collection() already does this in reverse when the
    # recipient deletes their side; without this, deleting the sender's side
    # left an orphaned Collection that kept counting as received cash forever.
    # Prefer the real FK link (Collection.mirror_deposit_id); only fall back to
    # matching by coincidence for legacy rows created before that link existed.
    if deposit.deposit_type == "staff" and deposit.recipient_staff_id:
        matching_collection = db.scalar(
            select(Collection).where(Collection.mirror_deposit_id == deposit.id).with_for_update()
        )
        if not matching_collection:
            matching_collection = db.scalar(
                select(Collection).where(
                    and_(
                        Collection.from_staff_id == deposit.staff_id,
                        Collection.staff_id == deposit.recipient_staff_id,
                        Collection.total_amount == deposit.amount,
                        Collection.collection_date == deposit.deposit_date
                    )
                ).with_for_update()
            )
        if matching_collection:
            # The recipient's own delete window still protects their record: a
            # non-admin sender deleting their side must not silently bypass the
            # protection the recipient would otherwise have on their Collection.
            if current_user.role != "admin":
                settings = db.scalar(select(BusinessSettings).where(BusinessSettings.id == 1))
                recipient_window = settings.delete_window_minutes if settings else 5
                if recipient_window != -1 and datetime.utcnow() - matching_collection.created_at > timedelta(minutes=recipient_window):
                    raise HTTPException(
                        status_code=403,
                        detail="This handover can no longer be deleted — the recipient's own edit window has expired."
                    )
            db.execute(delete(Ledger).where(Ledger.collection_id == matching_collection.id))
            db.delete(matching_collection)

    # Handle Portal and Staff balance reversals
    if deposit.portal_id:
        portal = db.scalar(select(Portal).where(Portal.id == deposit.portal_id).with_for_update())
        if portal:
            lock_portal_group(db, portal)
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
                    if portal.group:
                        portal.group.balance -= Decimal(str(deposit.amount))
                else:
                    # Deleting virtual load: increase portal balance since load is reverted
                    portal.balance += Decimal(str(deposit.amount))
                    if portal.group:
                        portal.group.balance += Decimal(str(deposit.amount))

    # Reverse portal_transfer balances if needed
    if deposit.deposit_type == "portal_transfer":
        if deposit.portal_id:
            dst_portal = db.scalar(select(Portal).where(Portal.id == deposit.portal_id).with_for_update())
            if dst_portal:
                lock_portal_group(db, dst_portal)
                dst_portal.balance -= Decimal(str(deposit.amount))
                if dst_portal.group:
                    dst_portal.group.balance -= Decimal(str(deposit.amount))
        if deposit.from_portal_id:
            src_portal = db.scalar(select(Portal).where(Portal.id == deposit.from_portal_id).with_for_update())
            if src_portal:
                lock_portal_group(db, src_portal)
                src_portal.balance += Decimal(str(deposit.amount))
                if src_portal.group:
                    src_portal.group.balance += Decimal(str(deposit.amount))

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
        # Check if within edit window
        settings = db.scalar(select(BusinessSettings).where(BusinessSettings.id == 1))
        edit_window = settings.edit_window_minutes if settings else 5
        if edit_window != -1:
            if datetime.utcnow() - deposit.created_at > timedelta(minutes=edit_window):
                raise HTTPException(status_code=403, detail=f"Can only update deposits within {edit_window} minutes of creation")

        # Backdating gate: reject with a clear error rather than silently
        # accepting/discarding a date change.
        staff_can_change_date = getattr(settings, 'staff_can_change_collection_date', False) if settings else False
        if payload.deposit_date != deposit.deposit_date and not staff_can_change_date:
            raise HTTPException(
                status_code=403,
                detail="Changing the deposit date is disabled for staff. Ask an admin to enable it."
            )

    # For a full update, it's safest to rely on the delete logic to reverse balances, 
    # and then the submit logic to re-apply them. However, since the endpoint is PUT
    # and we want to keep the same ID and created_at, we will do it manually.
    
    # First, reverse old balances (similar to delete_deposit)
    if deposit.portal_id:
        portal = db.scalar(select(Portal).where(Portal.id == deposit.portal_id).with_for_update())
        if portal:
            lock_portal_group(db, portal)
            if deposit.deposit_type == "portal":
                portal.balance -= Decimal(str(deposit.amount))
                if portal.group:
                    portal.group.balance -= Decimal(str(deposit.amount))
            elif deposit.deposit_type == "virtual":
                if deposit.payment_mode == "refund":
                    portal.balance -= Decimal(str(deposit.amount))
                    if portal.group:
                        portal.group.balance -= Decimal(str(deposit.amount))
                else:
                    portal.balance += Decimal(str(deposit.amount))
                    if portal.group:
                        portal.group.balance += Decimal(str(deposit.amount))

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

    # Lock affected retailers up front so the later recalculate_balances() calls
    # never race with a concurrent request touching the same retailer's ledger.
    if old_retailer_id:
        db.scalar(select(Retailer).where(Retailer.id == old_retailer_id).with_for_update())
    if payload.retailer_id and payload.retailer_id != old_retailer_id:
        db.scalar(select(Retailer).where(Retailer.id == payload.retailer_id).with_for_update())

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
            lock_portal_group(db, portal)
            portal.balance += Decimal(str(deposit.amount))
            if portal.group:
                portal.group.balance += Decimal(str(deposit.amount))
    elif dt == "virtual":
        portal = db.scalar(select(Portal).where(Portal.id == deposit.portal_id).with_for_update())
        if portal:
            lock_portal_group(db, portal)
            if deposit.payment_mode == "refund":
                portal.balance += Decimal(str(deposit.amount))
                if portal.group:
                    portal.group.balance += Decimal(str(deposit.amount))
            else:
                portal.balance -= Decimal(str(deposit.amount))
                if portal.group:
                    portal.group.balance -= Decimal(str(deposit.amount))
        
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
    dt = payload.deposit_type.lower().strip()
    
    if dt in ("virtual", "retailer"):
        # We need a ledger entry if there's a retailer_id
        if payload.retailer_id:
            txn_type = "debit"
            desc = "cash out"
            if dt == "virtual":
                # Matches submit_deposit's convention: load="credit" (adds),
                # refund="debit" (subtracts).
                txn_type = "debit" if payload.payment_mode == "refund" else "credit"
                portal = db.scalar(select(Portal).options(joinedload(Portal.group)).where(Portal.id == deposit.portal_id))
                desc = "move to distributor" if payload.payment_mode == "refund" else (portal.group.name if (portal and portal.group) else (portal.portal_name if portal else "virtual transfer"))
                
            if not ledger_entry:
                ledger_entry = Ledger(
                    retailer_id=payload.retailer_id,
                    transaction_type=txn_type,
                    amount=payload.amount,
                    balance=Decimal("0.00"),
                    description=desc,
                    deposit_id=deposit.id,
                    created_at=deposit.created_at
                )
                db.add(ledger_entry)
            else:
                ledger_entry.retailer_id = payload.retailer_id
                ledger_entry.amount = payload.amount
                ledger_entry.transaction_type = txn_type
                ledger_entry.description = desc
        else:
            if ledger_entry:
                db.delete(ledger_entry)
                ledger_entry = None
    else:
        # If the deposit type is no longer retailer/virtual, but ledger entry exists, delete it
        if ledger_entry:
            db.delete(ledger_entry)
            ledger_entry = None

    if payload.deposit_date:
        import pytz
        from datetime import datetime
        ist = pytz.timezone('Asia/Kolkata')
        current_time_ist = datetime.now(ist).time()
        transfer_datetime_ist = datetime.combine(payload.deposit_date, current_time_ist)
        transfer_datetime_utc = ist.localize(transfer_datetime_ist).astimezone(pytz.utc).replace(tzinfo=None)
        deposit.created_at = transfer_datetime_utc
        if ledger_entry:
            ledger_entry.created_at = transfer_datetime_utc
        
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
    deposit.bank_name = deposit.portal.bank_name if deposit.portal else None
    deposit.is_refund = (deposit.payment_mode == "refund")
    
    if deposit.retailer_id and deposit.retailer:
        deposit.target_name = deposit.retailer.retailer_name
        deposit.retailer_ledger_token = deposit.retailer.ledger_token
    elif deposit.recipient_staff_id and deposit.recipient_staff:
        deposit.target_name = deposit.recipient_staff.name
    else:
        deposit.target_name = deposit.portal_name

    return deposit

