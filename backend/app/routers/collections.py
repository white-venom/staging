import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy import select, and_, desc, update
from sqlalchemy.orm import Session, joinedload

from app.database.db import get_db
from app.database.models import Collection, Denomination, Retailer, Ledger, User, Store, Portal, BankDeposit
from app.schemas.collection import CollectionCreate, CollectionResponse
from app.dependencies import require_staff, require_admin, require_any_user
from app.logic.ledger import recalculate_balances

router = APIRouter(prefix="/collections", tags=["Collections Control"])


@router.post("", response_model=CollectionResponse, status_code=status.HTTP_201_CREATED)
def submit_collection(
    payload: CollectionCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(require_staff)
):
    """Staff submits a daily retailer cash/cashless collection. Auto-verifies that total strictly equals denominations sum."""
    # Source validation
    retailer = None
    from_staff = None
    
    if payload.retailer_id:
        retailer = db.scalar(select(Retailer).where(Retailer.id == payload.retailer_id).with_for_update())
        if not retailer:
            raise HTTPException(status_code=404, detail="Retailer not found")
        
        # Verify Store exists if provided
        if payload.store_id:
            store = db.scalar(select(Store).where(Store.id == payload.store_id))
            if not store:
                raise HTTPException(status_code=404, detail="Store not found")
    elif payload.from_staff_id:
        from_staff = db.scalar(select(User).where(User.id == payload.from_staff_id))
        if not from_staff:
            raise HTTPException(status_code=404, detail="Source staff member not found")
    elif not payload.from_office:
        raise HTTPException(status_code=400, detail="Must specify a source (Retailer, Staff, or Office)")

    # Calculate exact denomination totals
    d = payload.denominations
    cash_sum = (
        Decimal(str(d.note_500)) * Decimal("500.00") +
        Decimal(str(d.note_200)) * Decimal("200.00") +
        Decimal(str(d.note_100)) * Decimal("100.00") +
        Decimal(str(d.note_50)) * Decimal("50.00") +
        Decimal(str(d.note_20)) * Decimal("20.00") +
        Decimal(str(d.note_10)) * Decimal("10.00") +
        Decimal(str(d.coins))
    )
    computed_total = cash_sum + Decimal(str(d.online_amount))

    # Reject if total doesn't match computed breakdown
    if computed_total != payload.total_amount:
        raise HTTPException(
            status_code=400,
            detail=f"Verification failed: Submitted Total (₹{payload.total_amount:.2f}) does not match computed denomination sum (₹{computed_total:.2f})! "
                   f"(Cash: ₹{cash_sum:.2f}, Cashless Scan: ₹{d.online_amount:.2f})"
        )

    # Perform within a database transaction
    try:
        db_collection = Collection(
            retailer_id=payload.retailer_id,
            staff_id=current_user.id,
            from_staff_id=payload.from_staff_id,
            from_office=payload.from_office,
            store_id=payload.store_id,
            portal_id=payload.portal_id,
            total_amount=payload.total_amount,
            remarks=payload.remarks,
            status="verified"
        )
        db.add(db_collection)
        db.flush() 

        # 1. Denominations
        db_denom = Denomination(
            collection_id=db_collection.id,
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

        # 2. Ledger Bookkeeping (RETAILERS / PORTALS)
        if payload.retailer_id:
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
            
            new_balance = prev_balance - payload.total_amount
            
            ledger_entry = Ledger(
                retailer_id=payload.retailer_id,
                transaction_type="credit",
                amount=payload.total_amount,
                balance=new_balance,
                description="cash collection (auto-verified)",
                collection_id=db_collection.id
            )
            db.add(ledger_entry)
            
            retailer.balance = new_balance
            db_collection.balance_snapshot = new_balance
            
        elif payload.portal_id:
            portal = db.scalar(select(Portal).where(Portal.id == payload.portal_id).with_for_update())
            if portal:
                portal.balance -= Decimal(str(payload.total_amount))
                db_collection.balance_snapshot = portal.balance
                if portal.group:
                    portal.group.balance -= Decimal(str(payload.total_amount))
        elif payload.from_staff_id:
            # Auto-create corresponding BankDeposit for the sender staff (from_staff_id)
            # representing the handover payout to the recipient staff (current_user.id)
            db_deposit = BankDeposit(
                staff_id=payload.from_staff_id,
                deposit_type="staff",
                recipient_staff_id=current_user.id,
                to_office=False,
                payment_mode="cash",
                amount=payload.total_amount,
                deposit_date=db_collection.collection_date,
                status="verified",
                balance_snapshot=Decimal("0.00")
            )
            db.add(db_deposit)
            db.flush()

            # Save denominations for the deposit matching the collection
            db_deposit_denom = Denomination(
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
            db.add(db_deposit_denom)
            db_collection.balance_snapshot = Decimal("0.00")
        else:
            db_collection.balance_snapshot = Decimal("0.00")

        db.commit()
        db.refresh(db_collection)
        
        # Populate virtual fields for response
        if retailer:
            db_collection.retailer_name = retailer.retailer_name
            db_collection.store_name = db_collection.store.store_name if db_collection.store else "Direct Retailer Handover"
        elif from_staff:
            db_collection.retailer_name = f"Staff: {from_staff.name}"
            db_collection.from_staff_name = from_staff.name
        elif payload.from_office:
            db_collection.retailer_name = "Office/Cash Chest"
            
        db_collection.staff_name = current_user.name
        
        # Portal name for response
        if db_collection.portal_id:
            portal_obj = db.scalar(select(Portal).where(Portal.id == db_collection.portal_id))
            db_collection.portal_name = portal_obj.portal_name if portal_obj else None

        # 3. Simulate Email Alert (Task 110: Auto-Verify)
        if retailer and retailer.email:
            secure_link = f"https://doitservice.com/public/ledger/{retailer.ledger_token}"
            print("\n" + "="*80)
            print("📨 [SMTP EMAIL DISPATCH SIMULATOR] TO RETAILER (AUTO-VERIFIED)")
            print(f"   ↳ Recipient: {retailer.retailer_name} <{retailer.email}>")
            print(f"   ↳ Subject: Collection Receipt - DO IT SERVICES (Ref: {db_collection.id.hex[:8]})")
            print(f"   ↳ Body Preview:")
            print(f"     Dear Partner,")
            print(f"     We have successfully received your payment collection of ₹{db_collection.total_amount:.2f} today.")
            print(f"     Your outstanding ledger balance has been updated to: ₹{new_balance:.2f}.")
            print(f"     You can view your secure, real-time live statement anytime here:")
            print(f"     🔗 {secure_link}")
            print("="*80 + "\n")

        # Trigger WhatsApp message asynchronously
        if retailer and retailer.phone:
            try:
                from app.services.whatsapp import send_whatsapp_message
                background_tasks.add_task(
                    send_whatsapp_message,
                    to_phone_number=retailer.phone,
                    template_name="retailer_payment_receipt",
                    variables=[retailer.retailer_name, str(db_collection.total_amount), secure_link]
                )
            except Exception as whatsapp_err:
                print(f"Error queueing WhatsApp message for collection: {whatsapp_err}")

        return db_collection
    except Exception as e:
        db.rollback()
        print(f"Error during collection insertion: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred while processing the collection.")


@router.get("", response_model=List[CollectionResponse])
def list_collections(
    retailer_id: Optional[uuid.UUID] = None,
    store_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_any_user)
):
    """List collection submissions. Staff is restricted to viewing only their own entries; Admins see all."""
    query = select(Collection)
    
    # Apply role restriction
    if current_user.role != "admin":
        query = query.where(Collection.staff_id == current_user.id)

    # Apply filters
    filters = []
    if retailer_id:
        filters.append(Collection.retailer_id == retailer_id)
    if store_id:
        filters.append(Collection.store_id == store_id)
    if status:
        filters.append(Collection.status == status)
        
    if filters:
        query = query.where(and_(*filters))

    query = query.options(
        joinedload(Collection.retailer), 
        joinedload(Collection.store), 
        joinedload(Collection.staff),
        joinedload(Collection.from_staff),
        joinedload(Collection.portal),
        joinedload(Collection.denominations)
    )
    collections = db.scalars(query.order_by(desc(Collection.created_at))).all()
    
    # Manually populate virtual fields for the response model
    for col in collections:
        if col.retailer:
            col.retailer_name = col.retailer.retailer_name
        elif col.from_staff:
            col.retailer_name = f"Staff: {col.from_staff.name}"
            col.from_staff_name = col.from_staff.name
        elif col.from_office:
            col.retailer_name = "Office"
        else:
            col.retailer_name = "Unknown Source"
            
        col.store_name = col.store.store_name if col.store else "Direct Handover"
        col.staff_name = col.staff.name if col.staff else "Unknown Staff"
        col.portal_name = col.portal.portal_name if col.portal else None
        
    return collections


@router.put("/{collection_id}/verify", response_model=CollectionResponse)
def verify_collection(
    collection_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Admin verifies a collection entry. Triggers live ledger bookkeeping and automated email alerts to retailers."""
    collection = db.scalar(select(Collection).where(Collection.id == collection_id).with_for_update())
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    if collection.status == "verified":
        raise HTTPException(status_code=400, detail="This collection has already been verified and logged!")
        
    if not collection.retailer_id:
        raise HTTPException(status_code=400, detail="Can only verify retailer collections via this endpoint.")

    # Lock the retailer
    retailer = db.scalar(select(Retailer).where(Retailer.id == collection.retailer_id).with_for_update())

    # 1. Update status
    collection.status = "verified"

    # 2. Bookkeep: Insert Credit transaction in Ledgers
    # Calculate previous balance
    latest_ledger = db.scalar(
        select(Ledger)
        .where(Ledger.retailer_id == collection.retailer_id)
        .order_by(desc(Ledger.created_at), desc(Ledger.id))
        .limit(1)
    )
    
    if latest_ledger:
        prev_balance = latest_ledger.balance
    else:
        # Respect opening balance
        prev_balance = Decimal(str(collection.retailer.opening_to_take or 0))
    
    # Collections reduce what they owe DO IT SERVICES (credit)
    new_balance = prev_balance - collection.total_amount

    ledger_entry = Ledger(
        retailer_id=collection.retailer_id,
        transaction_type="credit",
        amount=collection.total_amount,
        balance=new_balance,
        description="cash collection",
        collection_id=collection.id
    )
    db.add(ledger_entry)
    
    # UPDATE RETAILER BALANCE FIELD
    if collection.retailer:
        collection.retailer.balance = new_balance
    
    db.commit()
    db.refresh(collection)

    # 3. Simulate Email Alert with Secure Public Token
    retailer = collection.retailer
    if retailer and retailer.email:
        secure_link = f"https://doitservice.com/public/ledger/{retailer.ledger_token}"
        print("\n" + "="*80)
        print("📨 [SMTP EMAIL DISPATCH SIMULATOR] TO RETAILER")
        print(f"   ↳ Recipient: {retailer.retailer_name} <{retailer.email}>")
        print(f"   ↳ Subject: Collection Receipt - DO IT SERVICES (Ref: {collection.id.hex[:8]})")
        print(f"   ↳ Body Preview:")
        print(f"     Dear Partner,")
        print(f"     We have successfully received and verified your payment collection of ₹{collection.total_amount:.2f} today.")
        print(f"     Your outstanding ledger balance has been updated to: ₹{new_balance:.2f}.")
        print(f"     You can view your secure, real-time live statement anytime here:")
        print(f"     🔗 {secure_link}")
        print("="*80 + "\n")
        
    # Trigger WhatsApp message asynchronously
    if retailer and retailer.phone:
        try:
            from app.services.whatsapp import send_whatsapp_message
            background_tasks.add_task(
                send_whatsapp_message,
                to_phone_number=retailer.phone,
                template_name="retailer_payment_receipt",
                variables=[retailer.retailer_name, str(collection.total_amount), secure_link]
            )
        except Exception as whatsapp_err:
            print(f"Error queueing WhatsApp message for collection verification: {whatsapp_err}")

    return collection

from app.logic.ledger import recalculate_balances

@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_collection(
    collection_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_any_user)
):
    """Admin or Staff (within 5 mins): Delete a collection and its associated ledger entry, then fix following balances."""
    collection = db.scalar(select(Collection).where(Collection.id == collection_id).with_for_update())
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
        
    if current_user.role != "admin":
        if collection.staff_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this collection")
        # Check if within 5 minutes
        if datetime.utcnow() - collection.created_at > timedelta(minutes=5):
            raise HTTPException(status_code=403, detail="Can only delete collections within 5 minutes of creation")
    
    retailer_id = collection.retailer_id
    
    # Delete associated ledger entries (cascade is set to SET NULL in model, so we find and delete manually)
    from sqlalchemy import delete
    db.execute(delete(Ledger).where(Ledger.collection_id == collection_id))
    
    # Restore portal balance if the collection was against a portal
    if collection.portal_id:
        portal = db.scalar(select(Portal).where(Portal.id == collection.portal_id).with_for_update())
        if portal:
            portal.balance += Decimal(str(collection.total_amount))
            if portal.group:
                portal.group.balance += Decimal(str(collection.total_amount))

    # Delete corresponding staff handover deposit if this is a staff-to-staff collection
    if collection.from_staff_id:
        db.execute(
            delete(BankDeposit).where(
                and_(
                    BankDeposit.deposit_type == "staff",
                    BankDeposit.staff_id == collection.from_staff_id,
                    BankDeposit.recipient_staff_id == collection.staff_id,
                    BankDeposit.amount == collection.total_amount,
                    BankDeposit.deposit_date == collection.collection_date
                )
            )
        )
                
    db.delete(collection)
    db.commit()
    
    # Recalculate balances for this retailer
    if retailer_id:
        recalculate_balances(retailer_id, db)
        db.commit()
    return None

@router.put("/{collection_id}", response_model=CollectionResponse)
def update_collection(
    collection_id: uuid.UUID,
    payload: CollectionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_any_user)
):
    """Admin or Staff (within 5 mins): Update collection amount, retailer, portal, or details and recalculate balances."""
    collection = db.scalar(select(Collection).where(Collection.id == collection_id).with_for_update())
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
        
    if current_user.role != "admin":
        if collection.staff_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to update this collection")
        # Check if within 5 minutes
        if datetime.utcnow() - collection.created_at > timedelta(minutes=5):
            raise HTTPException(status_code=403, detail="Can only update collections within 5 minutes of creation")
    
    old_amount = collection.total_amount
    new_amount = payload.total_amount
    old_retailer_id = collection.retailer_id
    new_retailer_id = payload.retailer_id
    old_portal_id = collection.portal_id
    new_portal_id = payload.portal_id
    old_from_staff_id = collection.from_staff_id
    new_from_staff_id = payload.from_staff_id

    # Handle Portal Balance Adjustments
    if old_portal_id != new_portal_id:
        # Revert old portal
        if old_portal_id:
            old_portal = db.scalar(select(Portal).where(Portal.id == old_portal_id).with_for_update())
            if old_portal:
                old_portal.balance += Decimal(str(old_amount))
                if old_portal.group:
                    old_portal.group.balance += Decimal(str(old_amount))
        # Deduct new portal
        if new_portal_id:
            new_portal = db.scalar(select(Portal).where(Portal.id == new_portal_id).with_for_update())
            if new_portal:
                new_portal.balance -= Decimal(str(new_amount))
                if new_portal.group:
                    new_portal.group.balance -= Decimal(str(new_amount))
    elif old_portal_id and new_amount != old_amount:
        # Same portal, but amount changed
        diff = Decimal(str(new_amount)) - Decimal(str(old_amount))
        portal = db.scalar(select(Portal).where(Portal.id == old_portal_id).with_for_update())
        if portal:
            portal.balance -= diff
            if portal.group:
                portal.group.balance -= diff

    # Update main fields safely
    for field, value in payload.model_dump(exclude_unset=True, exclude={"denominations"}).items():
        setattr(collection, field, value)
        
    # Update denominations
    if collection.denominations:
        d = payload.denominations
        collection.denominations.note_500 = d.note_500
        collection.denominations.note_200 = d.note_200
        collection.denominations.note_100 = d.note_100
        collection.denominations.note_50 = d.note_50
        collection.denominations.note_20 = d.note_20
        collection.denominations.note_10 = d.note_10
        collection.denominations.coins = d.coins
        collection.denominations.online_amount = d.online_amount

    # Update ledger entry
    ledger_entry = db.scalar(select(Ledger).where(Ledger.collection_id == collection_id))
    if ledger_entry:
        ledger_entry.amount = new_amount
        if old_retailer_id != new_retailer_id:
            ledger_entry.retailer_id = new_retailer_id

    # Sync corresponding staff handover deposit if needed
    if old_from_staff_id != new_from_staff_id:
        # Delete old matching deposit if it existed
        if old_from_staff_id:
            db.execute(
                delete(BankDeposit).where(
                    and_(
                        BankDeposit.deposit_type == "staff",
                        BankDeposit.staff_id == old_from_staff_id,
                        BankDeposit.recipient_staff_id == collection.staff_id,
                        BankDeposit.amount == old_amount
                    )
                )
            )
        # Create new matching deposit if new is set
        if new_from_staff_id:
            db_deposit = BankDeposit(
                staff_id=new_from_staff_id,
                deposit_type="staff",
                recipient_staff_id=collection.staff_id,
                to_office=False,
                payment_mode="cash",
                amount=payload.total_amount,
                deposit_date=collection.collection_date,
                status="verified",
                balance_snapshot=Decimal("0.00")
            )
            db.add(db_deposit)
            db.flush()
            
            d = payload.denominations
            db_deposit_denom = Denomination(
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
            db.add(db_deposit_denom)
    elif new_from_staff_id:
        # Just update the existing matching deposit
        matching_deposit = db.scalar(
            select(BankDeposit).where(
                and_(
                    BankDeposit.deposit_type == "staff",
                    BankDeposit.staff_id == new_from_staff_id,
                    BankDeposit.recipient_staff_id == collection.staff_id,
                    BankDeposit.amount == old_amount
                )
            )
        )
        if matching_deposit:
            matching_deposit.amount = payload.total_amount
            matching_deposit.deposit_date = collection.collection_date
            if matching_deposit.denominations:
                d = payload.denominations
                matching_deposit.denominations.note_500 = d.note_500
                matching_deposit.denominations.note_200 = d.note_200
                matching_deposit.denominations.note_100 = d.note_100
                matching_deposit.denominations.note_50 = d.note_50
                matching_deposit.denominations.note_20 = d.note_20
                matching_deposit.denominations.note_10 = d.note_10
                matching_deposit.denominations.coins = d.coins
                matching_deposit.denominations.online_amount = d.online_amount
    
    # Recalculate balances
    if old_retailer_id != new_retailer_id:
        recalculate_balances(old_retailer_id, db)
    recalculate_balances(new_retailer_id, db)
    db.commit()
    
    db.refresh(collection)
    
    # Populate virtual fields
    collection.retailer_name = collection.retailer.retailer_name if collection.retailer else "Unknown"
    collection.store_name = collection.store.store_name if collection.store else "Direct Retailer Handover"
    collection.staff_name = collection.staff.name if collection.staff else "Unknown"
    collection.portal_name = collection.portal.portal_name if collection.portal else None
    
    return collection
