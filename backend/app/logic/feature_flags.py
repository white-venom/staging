"""Per-tenant feature flag registry and enforcement helpers.

To add a new toggleable feature:
  1. Add one entry to FEATURE_REGISTRY below (key, label, description, category).
  2. At the backend endpoint(s) that implement it, add a dependency:
         Depends(require_feature("your_feature_key"))
     (or call `is_feature_enabled(request, "your_feature_key")` directly if you
     need a plain bool instead of a 403-raising dependency, e.g. to silently
     skip a step rather than reject the whole request).
  3. That's it -- the superadmin UI reads FEATURE_REGISTRY from
     GET /superadmin/feature-flags/registry, so a new entry appears there
     automatically with no separate frontend change needed.

See docs/FEATURE_FLAGS.md for the full guide.
"""
from typing import Optional
from fastapi import Request, HTTPException, status

from app.database.db import MasterSessionLocal, resolve_tenant_subdomain, get_current_tenant_row


FEATURE_REGISTRY = [
    {
        "key": "staff_backdating",
        "label": "Staff Backdating",
        "description": "Lets staff pick a date other than today when creating or editing a cash-in/cash-out entry (still subject to the tenant's own on/off setting for this).",
        "category": "Cash Operations",
        "enforced": "backend",
    },
    {
        "key": "staff_handover",
        "label": "Staff-to-Staff Handover",
        "description": "Lets a staff member hand cash directly to another staff member (Cash Out > Staff), auto-creating the matching entry on the recipient's side.",
        "category": "Cash Operations",
        "enforced": "backend",
    },
    {
        "key": "virtual_transfer",
        "label": "Virtual Transfer",
        "description": "Lets an admin credit a retailer or staff member's balance directly from a bank/portal account without a physical cash movement.",
        "category": "Cash Operations",
        "enforced": "backend",
    },
    {
        "key": "portal_transfer",
        "label": "Portal-to-Portal Transfer",
        "description": "Lets an admin move balance directly between two bank accounts (possibly under different portals).",
        "category": "Cash Operations",
        "enforced": "backend",
    },
    {
        "key": "denomination_baseline",
        "label": "Denomination Baseline",
        "description": "Lets an admin set a verified physical cash-count snapshot for a staff member, used as a trusted starting point for their pocket-cash calculation.",
        "category": "Staff Tools",
        "enforced": "backend",
    },
    {
        "key": "attendance_tracking",
        "label": "Attendance & KM Tracking",
        "description": "Lets staff check in/out with start/end KM and GPS. Turning this off blocks the check-in/check-out endpoints entirely for the tenant.",
        "category": "Staff Tools",
        "enforced": "backend",
    },
    {
        "key": "pdf_export",
        "label": "PDF / Report Export",
        "description": "Shows the PDF/Excel download buttons on ledger and report views. Export happens entirely in the browser (no server-side PDF generation exists to gate), so this flag is enforced in the UI only.",
        "category": "Reporting",
        "enforced": "ui",
    },
]

FEATURE_KEYS = {f["key"] for f in FEATURE_REGISTRY}

# Small in-process cache so a hot write path (e.g. submit_collection) doesn't
# hit the master DB on every single request just to check one flag. Cleared
# whenever superadmin changes a flag (see super_admin_features.py).
_flag_cache: dict[tuple[str, str], bool] = {}


def invalidate_feature_cache(tenant_id: Optional[str] = None):
    if tenant_id is None:
        _flag_cache.clear()
        return
    for k in list(_flag_cache.keys()):
        if k[0] == str(tenant_id):
            _flag_cache.pop(k, None)


def is_feature_enabled_for_tenant_id(tenant_id: str, feature_key: str) -> bool:
    """Direct lookup by master-DB tenant UUID (string). Defaults to enabled
    when no explicit row exists -- see TenantFeatureFlags docstring."""
    cache_key = (str(tenant_id), feature_key)
    if cache_key in _flag_cache:
        return _flag_cache[cache_key]

    from app.database.master_models import TenantFeatureFlags
    from sqlalchemy import select

    master_db = MasterSessionLocal()
    try:
        row = master_db.scalar(
            select(TenantFeatureFlags).where(
                TenantFeatureFlags.tenant_id == tenant_id,
                TenantFeatureFlags.feature_key == feature_key,
            )
        )
        enabled = row.enabled if row else True
        _flag_cache[cache_key] = enabled
        return enabled
    finally:
        master_db.close()


def is_feature_enabled(request: Request, feature_key: str) -> bool:
    """Resolve the current request's tenant, then check its flag. Safe default
    (True/enabled) if the tenant can't be resolved at all -- a broken tenant
    lookup should not be the thing that silently disables every feature."""
    tenant = get_current_tenant_row(request)
    if not tenant:
        return True
    return is_feature_enabled_for_tenant_id(str(tenant.id), feature_key)


def require_feature(feature_key: str):
    """FastAPI dependency factory: `Depends(require_feature("virtual_transfer"))`.
    Raises a clean 403 if the tenant has this feature turned off."""
    if feature_key not in FEATURE_KEYS:
        raise ValueError(f"Unknown feature_key '{feature_key}' -- add it to FEATURE_REGISTRY first.")

    def _dependency(request: Request):
        if not is_feature_enabled(request, feature_key):
            label = next((f["label"] for f in FEATURE_REGISTRY if f["key"] == feature_key), feature_key)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"'{label}' is not enabled for this account. Contact CrediiFlow support to turn it on."
            )

    return _dependency
