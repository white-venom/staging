import uuid
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select, func, create_engine
from sqlalchemy.orm import Session, sessionmaker
from pydantic import BaseModel, Field

from app.database.db import get_master_db, get_tenant_connection_string, get_tenant_engine
from app.database.master_models import Tenant, SuperAdmin
from app.routers.super_admin import get_current_super_admin, require_full_admin
from app.core.security import get_password_hash
from app.logic.audit import log_audit_event

router = APIRouter(prefix="/superadmin/tenants/{tenant_id}", tags=["Super Admin — Tenant Entity Management"])


def _get_tenant(tenant_id: uuid.UUID, master_db: Session) -> Tenant:
    tenant = master_db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


def _tenant_session(tenant: Tenant) -> Session:
    engine = get_tenant_engine(tenant.db_name)
    return sessionmaker(bind=engine)()


# ─── Retailers (items #3, #4) ────────────────────────────────────────────────

class SuperAdminRetailerUpdate(BaseModel):
    retailer_name: Optional[str] = Field(None, max_length=150)
    address: Optional[str] = Field(None, max_length=255)
    email: Optional[str] = None
    phone: Optional[str] = Field(None, max_length=20)
    category: Optional[str] = Field(None, max_length=100)
    # Deltas, same convention as the tenant-side endpoint this replaces.
    opening_to_give: Optional[float] = None
    opening_to_take: Optional[float] = None


@router.get("/retailers")
def list_tenant_retailers(
    tenant_id: uuid.UUID,
    master_db: Session = Depends(get_master_db),
    current_admin: SuperAdmin = Depends(get_current_super_admin)
):
    tenant = _get_tenant(tenant_id, master_db)
    from app.database import models
    tenant_db = _tenant_session(tenant)
    try:
        retailers = tenant_db.scalars(
            select(models.Retailer).where(models.Retailer.is_active == True).order_by(models.Retailer.retailer_name)
        ).all()
        return [
            {
                "id": str(r.id), "retailer_name": r.retailer_name, "phone": r.phone,
                "address": r.address, "email": r.email, "category": r.category,
                "opening_to_give": float(r.opening_to_give or 0), "opening_to_take": float(r.opening_to_take or 0),
                "balance": float(r.balance or 0),
            } for r in retailers
        ]
    finally:
        tenant_db.close()


@router.put("/retailers/{retailer_id}")
def update_tenant_retailer(
    tenant_id: uuid.UUID,
    retailer_id: uuid.UUID,
    payload: SuperAdminRetailerUpdate,
    request: Request,
    master_db: Session = Depends(get_master_db),
    current_admin: SuperAdmin = Depends(require_full_admin)
):
    """Superadmin-only edit of a Retailer's details and/or balance (opening_to_give /
    opening_to_take deltas), scoped to one tenant. Mirrors the tenant-side
    update_retailer() logic (duplicate-name/phone checks, negative-balance guard,
    ledger recalculation) since that endpoint is now blocked for a restricted
    tenant's own admin -- see items #3/#4."""
    tenant = _get_tenant(tenant_id, master_db)
    from app.database import models
    from app.logic.ledger import recalculate_balances
    tenant_db = _tenant_session(tenant)
    try:
        retailer = tenant_db.scalar(select(models.Retailer).where(models.Retailer.id == retailer_id).with_for_update())
        if not retailer:
            raise HTTPException(status_code=404, detail="Retailer not found")

        before = {
            "retailer_name": retailer.retailer_name, "phone": retailer.phone, "address": retailer.address,
            "email": retailer.email, "category": retailer.category,
            "opening_to_give": retailer.opening_to_give, "opening_to_take": retailer.opening_to_take,
            "balance": retailer.balance,
        }

        if payload.retailer_name is not None and payload.retailer_name.strip().lower() != retailer.retailer_name.strip().lower():
            dup = tenant_db.scalar(
                select(models.Retailer).where(
                    func.lower(models.Retailer.retailer_name) == payload.retailer_name.strip().lower(),
                    models.Retailer.is_active == True,
                    models.Retailer.id != retailer_id
                )
            )
            if dup:
                raise HTTPException(status_code=400, detail="Another retailer with this name already exists.")
            retailer.retailer_name = payload.retailer_name

        if payload.phone is not None and payload.phone != retailer.phone:
            dup_phone = tenant_db.scalar(select(models.Retailer).where(models.Retailer.phone == payload.phone))
            if dup_phone:
                raise HTTPException(status_code=400, detail="Another retailer with this phone number already exists.")
            retailer.phone = payload.phone

        if payload.address is not None:
            retailer.address = payload.address
        if payload.email is not None:
            retailer.email = payload.email
        if payload.category is not None:
            retailer.category = payload.category

        if payload.opening_to_give is not None:
            new_give = (retailer.opening_to_give or Decimal("0.00")) + Decimal(str(payload.opening_to_give))
            if new_give < 0:
                raise HTTPException(status_code=400, detail="To Give cannot be negative")
        if payload.opening_to_take is not None:
            new_take = (retailer.opening_to_take or Decimal("0.00")) + Decimal(str(payload.opening_to_take))
            if new_take < 0:
                raise HTTPException(status_code=400, detail="To Take cannot be negative")

        has_ob_change = (payload.opening_to_give is not None or payload.opening_to_take is not None)
        if has_ob_change:
            from app.core.timezone import ist_today
            retailer.opening_balance_set_on = ist_today()
        if payload.opening_to_give is not None:
            retailer.opening_to_give = (retailer.opening_to_give or Decimal("0.00")) + Decimal(str(payload.opening_to_give))
        if payload.opening_to_take is not None:
            delta_take = Decimal(str(payload.opening_to_take))
            retailer.opening_to_take = (retailer.opening_to_take or Decimal("0.00")) + delta_take

        tenant_db.commit()
        recalculate_balances(retailer_id, tenant_db, update_opening_timestamp=has_ob_change)
        tenant_db.commit()
        tenant_db.refresh(retailer)

        after = {
            "retailer_name": retailer.retailer_name, "phone": retailer.phone, "address": retailer.address,
            "email": retailer.email, "category": retailer.category,
            "opening_to_give": retailer.opening_to_give, "opening_to_take": retailer.opening_to_take,
            "balance": retailer.balance,
        }
        log_audit_event(
            request, actor_type="superadmin", action="retailer.update",
            actor_id=current_admin.id, actor_name=current_admin.name,
            entity_type="Retailer", entity_id=retailer.id, before=before, after=after,
            description=f"Superadmin edited retailer '{retailer.retailer_name}'",
            tenant_override_subdomain=tenant.subdomain,
        )

        return {
            "id": str(retailer.id), "retailer_name": retailer.retailer_name, "phone": retailer.phone,
            "address": retailer.address, "email": retailer.email, "category": retailer.category,
            "opening_to_give": float(retailer.opening_to_give or 0), "opening_to_take": float(retailer.opening_to_take or 0),
            "balance": float(retailer.balance or 0),
        }
    except HTTPException:
        tenant_db.rollback()
        raise
    finally:
        tenant_db.close()


# ─── Staff (item #3) ──────────────────────────────────────────────────────────

class SuperAdminStaffUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    role: Optional[str] = None
    password: Optional[str] = Field(None, min_length=6)


@router.get("/staff")
def list_tenant_staff(
    tenant_id: uuid.UUID,
    master_db: Session = Depends(get_master_db),
    current_admin: SuperAdmin = Depends(get_current_super_admin)
):
    tenant = _get_tenant(tenant_id, master_db)
    from app.database import models
    tenant_db = _tenant_session(tenant)
    try:
        users = tenant_db.scalars(
            select(models.User).where(models.User.is_active == True).order_by(models.User.name)
        ).all()
        return [
            {"id": str(u.id), "name": u.name, "phone": u.phone, "role": u.role}
            for u in users
        ]
    finally:
        tenant_db.close()


@router.put("/staff/{user_id}")
def update_tenant_staff(
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: SuperAdminStaffUpdate,
    request: Request,
    master_db: Session = Depends(get_master_db),
    current_admin: SuperAdmin = Depends(require_full_admin)
):
    """Superadmin-only edit of a Staff/Admin user's details, scoped to one tenant --
    see item #3."""
    tenant = _get_tenant(tenant_id, master_db)
    from app.database import models
    tenant_db = _tenant_session(tenant)
    try:
        user = tenant_db.scalar(select(models.User).where(models.User.id == user_id).with_for_update())
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        before = {"name": user.name, "phone": user.phone, "role": user.role}

        if payload.phone is not None and payload.phone != user.phone:
            dup = tenant_db.scalar(select(models.User).where(models.User.phone == payload.phone))
            if dup:
                status_desc = "active" if dup.is_active else "inactive"
                raise HTTPException(status_code=400, detail=f"Another {status_desc} user with this phone number already exists.")
            user.phone = payload.phone
        if payload.name is not None:
            user.name = payload.name
        if payload.role is not None:
            user.role = payload.role
        if payload.password:
            user.password_hash = get_password_hash(payload.password)

        tenant_db.commit()
        tenant_db.refresh(user)

        after = {"name": user.name, "phone": user.phone, "role": user.role}
        log_audit_event(
            request, actor_type="superadmin", action="staff.update",
            actor_id=current_admin.id, actor_name=current_admin.name,
            entity_type="User", entity_id=user.id, before=before, after=after,
            description=f"Superadmin edited staff '{user.name}'",
            tenant_override_subdomain=tenant.subdomain,
        )
        return {"id": str(user.id), "name": user.name, "phone": user.phone, "role": user.role}
    except HTTPException:
        tenant_db.rollback()
        raise
    finally:
        tenant_db.close()


# ─── Stores (item #3) ─────────────────────────────────────────────────────────

class SuperAdminStoreUpdate(BaseModel):
    store_name: Optional[str] = Field(None, max_length=150)
    address: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)


@router.get("/retailers/{retailer_id}/stores")
def list_tenant_stores(
    tenant_id: uuid.UUID,
    retailer_id: uuid.UUID,
    master_db: Session = Depends(get_master_db),
    current_admin: SuperAdmin = Depends(get_current_super_admin)
):
    tenant = _get_tenant(tenant_id, master_db)
    from app.database import models
    tenant_db = _tenant_session(tenant)
    try:
        stores = tenant_db.scalars(
            select(models.Store).where(models.Store.retailer_id == retailer_id).order_by(models.Store.store_name)
        ).all()
        return [{"id": str(s.id), "store_name": s.store_name, "address": s.address, "phone": s.phone} for s in stores]
    finally:
        tenant_db.close()


@router.put("/stores/{store_id}")
def update_tenant_store(
    tenant_id: uuid.UUID,
    store_id: uuid.UUID,
    payload: SuperAdminStoreUpdate,
    request: Request,
    master_db: Session = Depends(get_master_db),
    current_admin: SuperAdmin = Depends(require_full_admin)
):
    """Superadmin-only edit of a Store's details, scoped to one tenant -- see
    item #3. Does not cover the rare CMS-retailer store-reassignment feature
    (new_retailer_id) that the tenant-side endpoint also supports; that stays a
    tenant-admin operation on the CMS pseudo-retailer, out of scope here."""
    tenant = _get_tenant(tenant_id, master_db)
    from app.database import models
    tenant_db = _tenant_session(tenant)
    try:
        store = tenant_db.scalar(select(models.Store).where(models.Store.id == store_id).with_for_update())
        if not store:
            raise HTTPException(status_code=404, detail="Store not found")

        before = {"store_name": store.store_name, "address": store.address, "phone": store.phone}

        if payload.store_name is not None:
            store.store_name = payload.store_name
        if payload.address is not None:
            store.address = payload.address
        if payload.phone is not None:
            store.phone = payload.phone

        tenant_db.commit()
        tenant_db.refresh(store)

        after = {"store_name": store.store_name, "address": store.address, "phone": store.phone}
        log_audit_event(
            request, actor_type="superadmin", action="store.update",
            actor_id=current_admin.id, actor_name=current_admin.name,
            entity_type="Store", entity_id=store.id, before=before, after=after,
            description=f"Superadmin edited store '{store.store_name}'",
            tenant_override_subdomain=tenant.subdomain,
        )
        return {"id": str(store.id), "store_name": store.store_name, "address": store.address, "phone": store.phone}
    except HTTPException:
        tenant_db.rollback()
        raise
    finally:
        tenant_db.close()
