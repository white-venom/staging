import uuid
from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select, update, desc
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel, Field

from app.database.db import get_db, get_current_tenant_row
from app.database.models import BusinessSettings, Attendance, BankAccount, Retailer, Ledger, User, BankDeposit
from datetime import date
from app.dependencies import require_admin, require_any_user
from app.logic.feature_flags import require_feature

router = APIRouter(prefix="/admin-settings", tags=["Admin Control Panel"])

class SettingsUpdate(BaseModel):
    late_threshold: str
    late_penalty: float
    auto_checkout_time: str
    # edit_window_minutes / delete_window_minutes intentionally NOT here anymore --
    # that control moved to the superadmin panel (per-tenant, see item #2). A
    # tenant admin can no longer see or change it from this endpoint.
    opening_cash_in_hand: float = 0.0
    staff_can_change_collection_date: bool = False

class PenaltyApproval(BaseModel):
    attendance_id: uuid.UUID
    approve: bool

class VirtualTransferRequest(BaseModel):
    bank_account_id: uuid.UUID
    retailer_id: Optional[uuid.UUID] = None
    staff_id: Optional[uuid.UUID] = None
    # Bounded to what the DB's NUMERIC(12,2) column can actually store.
    amount: Decimal = Field(..., gt=0, le=Decimal("9999999999.99"))
    remarks: Optional[str] = None
    direction: str = "load"  # "load" (BankAccount -> Retailer) or "refund" (Retailer -> BankAccount)
    transfer_date: Optional[date] = None

@router.get("/business", response_model=dict)
def get_business_settings(request: Request, db: Session = Depends(get_db), current_user=Depends(require_any_user)):
    settings = db.scalar(select(BusinessSettings).where(BusinessSettings.id == 1))

    # Edit/delete windows are now superadmin-controlled, per-tenant (item #2) --
    # sourced from the master DB's Tenant row, never from this tenant's own
    # BusinessSettings. Still exposed here (read-only) so staff/admin UIs that
    # gate their own Edit/Delete buttons keep working without a separate call.
    tenant = get_current_tenant_row(request)
    edit_window_minutes = tenant.edit_window_minutes if tenant else 10
    delete_window_minutes = tenant.delete_window_minutes if tenant else 10
    tenant_admin_can_edit_entities = tenant.tenant_admin_can_edit_entities if tenant else False
    # Item #3: admin's own (separate, longer) window, plus the whole-feature toggle.
    time_window_lock_enabled = tenant.time_window_lock_enabled if tenant else True
    admin_edit_window_minutes = tenant.admin_edit_window_minutes if tenant else 30
    admin_delete_window_minutes = tenant.admin_delete_window_minutes if tenant else 30

    # Superadmin-controlled feature flags for this tenant (Part 1) -- exposed
    # here since this endpoint is already fetched broadly by staff/admin UIs.
    # Features with no separate backend call to gate (e.g. client-side PDF
    # export) rely entirely on this map to decide whether to render.
    from app.logic.feature_flags import is_feature_enabled_for_tenant_id, FEATURE_KEYS
    feature_flags = {
        key: (is_feature_enabled_for_tenant_id(str(tenant.id), key) if tenant else True)
        for key in FEATURE_KEYS
    }

    if not settings:
        return {
            "late_threshold": "10:00",
            "late_penalty": 100.0,
            "auto_checkout_time": "20:00",
            "edit_window_minutes": edit_window_minutes,
            "delete_window_minutes": delete_window_minutes,
            "opening_cash_in_hand": 0.0,
            "staff_can_change_collection_date": False,
            "tenant_admin_can_edit_entities": tenant_admin_can_edit_entities,
            "time_window_lock_enabled": time_window_lock_enabled,
            "admin_edit_window_minutes": admin_edit_window_minutes,
            "admin_delete_window_minutes": admin_delete_window_minutes,
            "feature_flags": feature_flags,
        }
    return {
        "late_threshold": settings.late_threshold,
        "late_penalty": settings.late_penalty,
        "auto_checkout_time": getattr(settings, 'auto_checkout_time', "20:00"),
        "edit_window_minutes": edit_window_minutes,
        "delete_window_minutes": delete_window_minutes,
        "opening_cash_in_hand": getattr(settings, 'opening_cash_in_hand', 0.0),
        "staff_can_change_collection_date": getattr(settings, 'staff_can_change_collection_date', False),
        "tenant_admin_can_edit_entities": tenant_admin_can_edit_entities,
        "time_window_lock_enabled": time_window_lock_enabled,
        "admin_edit_window_minutes": admin_edit_window_minutes,
        "admin_delete_window_minutes": admin_delete_window_minutes,
        "feature_flags": feature_flags,
    }

@router.put("/business")
def update_business_settings(data: SettingsUpdate, db: Session = Depends(get_db), current_user=Depends(require_admin)):
    settings = db.scalar(select(BusinessSettings).where(BusinessSettings.id == 1))
    if not settings:
        settings = BusinessSettings(
            id=1,
            late_threshold=data.late_threshold,
            late_penalty=data.late_penalty,
            auto_checkout_time=data.auto_checkout_time,
            opening_cash_in_hand=data.opening_cash_in_hand,
            staff_can_change_collection_date=data.staff_can_change_collection_date,
        )
        db.add(settings)
    else:
        settings.late_threshold = data.late_threshold
        settings.late_penalty = data.late_penalty
        settings.auto_checkout_time = data.auto_checkout_time
        settings.opening_cash_in_hand = data.opening_cash_in_hand
        settings.staff_can_change_collection_date = data.staff_can_change_collection_date
    db.commit()
    return {"message": "Settings updated successfully"}


@router.get("/pending-penalties")
def list_pending_penalties(db: Session = Depends(get_db), current_user=Depends(require_admin)):
    """List all attendance records that are late but penalty is not yet approved."""
    from app.routers.attendance import check_and_trigger_auto_checkout
    check_and_trigger_auto_checkout(db)
    
    stmt = select(Attendance).options(joinedload(Attendance.user)).where(Attendance.is_late == True, Attendance.is_penalty_approved == False)
    records = db.scalars(stmt).all()
    return [
        {
            "id": str(r.id),
            "staff_name": r.user.name,
            "date": str(r.date),
            "start_time": r.start_time.strftime("%H:%M:%S"),
            "penalty_amount": r.penalty_amount
        } for r in records
    ]

@router.post("/approve-penalty")
def approve_penalty(data: PenaltyApproval, db: Session = Depends(get_db), current_user=Depends(require_admin)):
    record = db.scalar(select(Attendance).where(Attendance.id == data.attendance_id))
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    
    if data.approve:
        record.is_penalty_approved = True
        # In a real system, you might deduct this from a 'staff_wallet' or 'ledger'
        # For now, we just mark it as approved.
    else:
        # If rejected, we remove the late flag/penalty
        record.is_late = False
        record.penalty_amount = 0.0
        
    db.commit()
    return {"message": "Penalty processed successfully"}

@router.post("/virtual-transfer")
def process_virtual_transfer(
    payload: VirtualTransferRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
    _feature=Depends(require_feature("virtual_transfer"))
):
    """Atomically transfers virtual balance from BankAccount to Retailer or Staff."""
    try:
        import pytz
        from datetime import datetime, time as dt_time, timezone
        ist = pytz.timezone('Asia/Kolkata')
        today_ist = payload.transfer_date or datetime.now(ist).date()
        current_time_ist = datetime.now(ist).time()
        
        if payload.transfer_date:
            transfer_datetime_ist = datetime.combine(payload.transfer_date, current_time_ist)
            transfer_datetime_utc = ist.localize(transfer_datetime_ist).astimezone(pytz.utc).replace(tzinfo=None)
        else:
            transfer_datetime_utc = datetime.now(timezone.utc).replace(tzinfo=None)

        # Validate inputs early
        if not payload.retailer_id and not payload.staff_id:
            raise HTTPException(status_code=400, detail="Either retailer_id or staff_id must be provided.")

        # 1. Fetch Source BankAccount (locked)
        # NOTE: Do NOT use joinedload(BankAccount.portal) here — PostgreSQL forbids
        # FOR UPDATE on the nullable side of an outer join.
        bank_account = db.scalar(
            select(BankAccount)
            .where(BankAccount.id == payload.bank_account_id)
            .with_for_update()
        )
        if not bank_account:
            raise HTTPException(status_code=404, detail="Source bank/wallet account not found.")
            
        # Lock the associated Portal to prevent race conditions on its balance
        account_portal = None
        if bank_account.portal_id:
            from app.database.models import Portal
            account_portal = db.scalar(
                select(Portal)
                .where(Portal.id == bank_account.portal_id)
                .with_for_update()
            )

        # Step A: Adjust the parent Portal's balance -- item #8: BankAccount
        # itself carries no balance of its own anymore.
        if payload.direction == "refund":
            if account_portal:
                account_portal.balance = Decimal(str(account_portal.balance or 0)) + payload.amount
        else:
            if account_portal:
                account_portal.balance = Decimal(str(account_portal.balance or 0)) - payload.amount
            
        if payload.retailer_id:
            # Transfer to/from Retailer
            retailer = db.scalar(select(Retailer).where(Retailer.id == payload.retailer_id).with_for_update())
            if not retailer:
                raise HTTPException(status_code=404, detail="Destination retailer not found.")
                
            # Matches deposits.py's virtual-transfer convention: load="credit"
            # (adds, same direction as a collection), refund="debit"
            # (subtracts, reverses a load).
            if payload.direction == "refund":
                desc_text = "move to distributor"
                transaction_type = "debit"
            else:
                # Safely get description text
                if account_portal:
                    desc_text = account_portal.name or "virtual transfer"
                elif bank_account:
                    desc_text = bank_account.bank_account_name or "virtual transfer"
                else:
                    desc_text = "virtual transfer"
                transaction_type = "credit"
            
            # Create the bank deposit audit record first with a placeholder balance
            db_deposit = BankDeposit(
                staff_id=current_user.id,
                deposit_type="virtual",
                bank_account_id=payload.bank_account_id,
                retailer_id=payload.retailer_id,
                amount=payload.amount,
                payment_mode="refund" if payload.direction == "refund" else "online",
                deposit_date=today_ist,
                created_at=transfer_datetime_utc,
                status="verified",
                balance_snapshot=Decimal("0"),
                remarks=payload.remarks
            )
            db.add(db_deposit)
            db.flush()
            
            # Create the ledger entry with a placeholder balance
            ledger_entry = Ledger(
                retailer_id=payload.retailer_id,
                transaction_type=transaction_type,
                amount=payload.amount,
                balance=Decimal("0"),
                description=desc_text,
                deposit_id=db_deposit.id,
                created_at=transfer_datetime_utc
            )
            db.add(ledger_entry)
            db.flush()
            
            # Recalculate all ledger balances from scratch — this is the single
            # source of truth and fixes any intermediate calculation errors
            from app.logic.ledger import recalculate_balances
            recalculate_balances(payload.retailer_id, db)
            db.flush()
            
            # After recalculation, re-read the final balance from the retailer
            db.refresh(retailer)
            final_balance = retailer.balance
            
            # Sync the bank deposit's balance_snapshot with the recalculated value
            recalculated_ledger = db.scalar(
                select(Ledger).where(Ledger.deposit_id == db_deposit.id)
            )
            if recalculated_ledger:
                db_deposit.balance_snapshot = recalculated_ledger.balance
            else:
                db_deposit.balance_snapshot = final_balance
            
            db.commit()

            from app.logic.audit import log_audit_event
            log_audit_event(
                request, actor_type=current_user.role, action="virtual_transfer",
                actor_id=current_user.id, actor_name=current_user.name,
                entity_type="Retailer", entity_id=retailer.id, amount=payload.amount,
                after={"direction": payload.direction, "bank_account_name": bank_account.bank_account_name, "target_name": retailer.retailer_name},
                description=f"{current_user.name} {'reversed' if payload.direction == 'refund' else 'sent'} a virtual transfer of ₹{payload.amount} {'from' if payload.direction=='refund' else 'to'} retailer '{retailer.retailer_name}'",
            )

            return {
                "message": "Virtual transfer processed successfully",
                "bank_account_name": bank_account.bank_account_name,
                "target_name": retailer.retailer_name,
                "new_bank_account_balance": float(account_portal.balance) if account_portal else float(bank_account.balance),
                "new_target_balance": float(final_balance)
            }
        else:
            # Transfer to Staff
            staff = db.scalar(select(User).where(User.id == payload.staff_id).with_for_update())
            if not staff:
                raise HTTPException(status_code=404, detail="Destination staff member not found.")
            
            current_virtual_balance = Decimal(str(staff.virtual_balance or 0))
            if payload.direction == "refund":
                staff.virtual_balance = current_virtual_balance - payload.amount
            else:
                staff.virtual_balance = current_virtual_balance + payload.amount
            
            db_deposit = BankDeposit(
                staff_id=current_user.id,
                deposit_type="virtual",
                bank_account_id=payload.bank_account_id,
                recipient_staff_id=payload.staff_id,
                amount=payload.amount,
                payment_mode="refund" if payload.direction == "refund" else "online",
                deposit_date=today_ist,
                created_at=transfer_datetime_utc,
                status="verified",
                balance_snapshot=staff.virtual_balance,
                remarks=payload.remarks
            )
            db.add(db_deposit)

            db.commit()

            from app.logic.audit import log_audit_event
            log_audit_event(
                request, actor_type=current_user.role, action="virtual_transfer",
                actor_id=current_user.id, actor_name=current_user.name,
                entity_type="User", entity_id=staff.id, amount=payload.amount,
                after={"direction": payload.direction, "bank_account_name": bank_account.bank_account_name, "target_name": staff.name},
                description=f"{current_user.name} {'reversed' if payload.direction == 'refund' else 'sent'} a virtual transfer of ₹{payload.amount} {'from' if payload.direction=='refund' else 'to'} staff '{staff.name}'",
            )

            return {
                "message": "Virtual transfer processed successfully",
                "bank_account_name": bank_account.bank_account_name,
                "target_name": staff.name,
                "new_bank_account_balance": float(account_portal.balance) if account_portal else float(bank_account.balance),
                "new_target_balance": float(staff.virtual_balance)
            }
            
    except HTTPException:
        try:
            db.rollback()
        except Exception:
            pass
        raise
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        import traceback
        traceback.print_exc()
        print(f"[ERROR] Virtual transfer failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Virtual transfer failed: {str(e)}"
        )


