"""Append-only cross-tenant audit trail -- see AuditLog in master_models.py.

Writing an audit entry must never be allowed to break the business transaction
it's describing (same treatment as the Cloudflare DNS / WhatsApp notification
calls elsewhere in this codebase): every write here is best-effort, wrapped so
a logging failure only prints a warning instead of rolling back real money
movement or a real edit.
"""
import uuid
from decimal import Decimal
from typing import Optional
from fastapi import Request

from app.database.db import MasterSessionLocal, resolve_tenant_subdomain


def _json_safe(value):
    """Recursively coerce a before/after snapshot dict into JSON-serializable
    values -- Decimal, UUID, date/datetime show up constantly in these models
    and none of them are natively JSON-encodable."""
    if value is None:
        return None
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, uuid.UUID):
        return str(value)
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def log_audit_event(
    request: Optional[Request],
    actor_type: str,
    action: str,
    actor_id=None,
    actor_name: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id=None,
    amount=None,
    before: Optional[dict] = None,
    after: Optional[dict] = None,
    description: Optional[str] = None,
    tenant_override_subdomain: Optional[str] = None,
) -> None:
    """Best-effort write of one audit_logs row to the master DB.

    tenant_override_subdomain lets a superadmin action (which has no tenant
    resolvable from the request itself, since it's authenticated against the
    master DB) explicitly say which tenant it acted on.
    """
    try:
        from app.database.master_models import AuditLog, Tenant

        subdomain = tenant_override_subdomain or (resolve_tenant_subdomain(request) if request else None)

        master_db = MasterSessionLocal()
        try:
            tenant_id = None
            tenant_name = None
            if subdomain:
                tenant = master_db.query(Tenant).filter(Tenant.subdomain == subdomain).first()
                if tenant:
                    tenant_id = tenant.id
                    tenant_name = tenant.name

            entry = AuditLog(
                tenant_id=tenant_id,
                tenant_name=tenant_name,
                actor_type=actor_type,
                actor_id=str(actor_id) if actor_id else None,
                actor_name=actor_name,
                action=action,
                entity_type=entity_type,
                entity_id=str(entity_id) if entity_id else None,
                amount=Decimal(str(amount)) if amount is not None else None,
                before_values=_json_safe(before),
                after_values=_json_safe(after),
                description=description,
                ip_address=request.client.host if (request and request.client) else None,
            )
            master_db.add(entry)
            master_db.commit()
        finally:
            master_db.close()
    except Exception as e:
        print(f"[WARN] Failed to write audit log entry (action={action}): {e}")


def log_tenant_error(
    request: Optional[Request],
    error_type: str,
    error_message: str,
) -> None:
    """Best-effort write of one tenant_error_logs row -- see TenantErrorLog in
    master_models.py. Called only from the global unhandled-exception handler
    in main.py, never for routine/expected 4xx responses (those aren't a
    health signal, they're normal traffic)."""
    try:
        from app.database.master_models import TenantErrorLog, Tenant

        subdomain = resolve_tenant_subdomain(request) if request else None

        master_db = MasterSessionLocal()
        try:
            tenant_id = None
            tenant_name = None
            if subdomain:
                tenant = master_db.query(Tenant).filter(Tenant.subdomain == subdomain).first()
                if tenant:
                    tenant_id = tenant.id
                    tenant_name = tenant.name

            entry = TenantErrorLog(
                tenant_id=tenant_id,
                tenant_name=tenant_name,
                method=request.method if request else None,
                path=str(request.url.path) if request else None,
                error_type=error_type,
                error_message=error_message[:1000] if error_message else None,
            )
            master_db.add(entry)
            master_db.commit()
        finally:
            master_db.close()
    except Exception as e:
        print(f"[WARN] Failed to write tenant error log entry: {e}")
