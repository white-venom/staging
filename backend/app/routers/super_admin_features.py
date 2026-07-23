import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database.db import get_master_db
from app.database.master_models import Tenant, SuperAdmin, TenantFeatureFlags
from app.routers.super_admin import get_current_super_admin
from app.logic.feature_flags import FEATURE_REGISTRY, FEATURE_KEYS, invalidate_feature_cache
from app.logic.audit import log_audit_event

router = APIRouter(prefix="/superadmin/feature-flags", tags=["Super Admin — Feature Flags"])


class FeatureFlagUpdate(BaseModel):
    enabled: bool


@router.get("/registry")
def get_feature_registry(current_admin: SuperAdmin = Depends(get_current_super_admin)):
    """The canonical list of toggleable features -- see feature_flags.py for
    how to register a new one. The superadmin UI renders this list directly,
    so a new registry entry shows up with no frontend change needed."""
    return {"features": FEATURE_REGISTRY}


@router.get("/tenants/{tenant_id}")
def get_tenant_flags(
    tenant_id: uuid.UUID,
    master_db: Session = Depends(get_master_db),
    current_admin: SuperAdmin = Depends(get_current_super_admin)
):
    tenant = master_db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    rows = master_db.scalars(select(TenantFeatureFlags).where(TenantFeatureFlags.tenant_id == tenant_id)).all()
    overrides = {r.feature_key: r.enabled for r in rows}

    # Every known feature, defaulted to enabled unless an explicit row says otherwise.
    return {
        "tenant_id": str(tenant_id),
        "flags": [
            {**f, "enabled": overrides.get(f["key"], True)}
            for f in FEATURE_REGISTRY
        ]
    }


@router.put("/tenants/{tenant_id}/{feature_key}")
def set_tenant_flag(
    tenant_id: uuid.UUID,
    feature_key: str,
    payload: FeatureFlagUpdate,
    request: Request,
    master_db: Session = Depends(get_master_db),
    current_admin: SuperAdmin = Depends(get_current_super_admin)
):
    if current_admin.role != "full":
        raise HTTPException(status_code=403, detail="Your support role is read-only and cannot change feature flags.")
    if feature_key not in FEATURE_KEYS:
        raise HTTPException(status_code=400, detail=f"Unknown feature_key '{feature_key}'")

    tenant = master_db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    row = master_db.scalar(
        select(TenantFeatureFlags).where(
            TenantFeatureFlags.tenant_id == tenant_id,
            TenantFeatureFlags.feature_key == feature_key,
        )
    )
    before = row.enabled if row else True
    if row:
        row.enabled = payload.enabled
        row.updated_by = current_admin.id
    else:
        row = TenantFeatureFlags(
            tenant_id=tenant_id, feature_key=feature_key,
            enabled=payload.enabled, updated_by=current_admin.id,
        )
        master_db.add(row)
    master_db.commit()

    # Takes effect immediately -- no redeploy, no restart: clear the in-process
    # cache so the very next request from this tenant sees the new value.
    invalidate_feature_cache(str(tenant_id))

    label = next((f["label"] for f in FEATURE_REGISTRY if f["key"] == feature_key), feature_key)
    log_audit_event(
        request, actor_type="superadmin", action="feature_flag.update",
        actor_id=current_admin.id, actor_name=current_admin.name,
        entity_type="TenantFeatureFlags", entity_id=tenant_id,
        before={"enabled": before}, after={"enabled": payload.enabled},
        description=f"Superadmin {'enabled' if payload.enabled else 'disabled'} '{label}' for tenant '{tenant.name}'",
        tenant_override_subdomain=tenant.subdomain,
    )

    return {"tenant_id": str(tenant_id), "feature_key": feature_key, "enabled": payload.enabled}
