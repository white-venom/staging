import uuid
from datetime import datetime, date, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc
from sqlalchemy.orm import Session

from app.database.db import get_master_db
from app.database.master_models import AuditLog, SuperAdmin
from app.routers.super_admin import get_current_super_admin

router = APIRouter(prefix="/superadmin/audit-log", tags=["Super Admin — Audit Log"])


@router.get("")
def search_audit_log(
    q: Optional[str] = Query(None, description="Free-text search over actor name, description, entity type"),
    tenant_id: Optional[uuid.UUID] = None,
    actor_type: Optional[str] = None,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_master_db),
    current_admin: SuperAdmin = Depends(get_current_super_admin)
):
    """Searchable/filterable cross-tenant audit trail for the superadmin panel --
    see item #6. Backed entirely by the append-only audit_logs table."""
    stmt = select(AuditLog)

    if tenant_id:
        stmt = stmt.where(AuditLog.tenant_id == tenant_id)
    if actor_type:
        stmt = stmt.where(AuditLog.actor_type == actor_type)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if date_from:
        stmt = stmt.where(AuditLog.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        stmt = stmt.where(AuditLog.created_at < datetime.combine(date_to + timedelta(days=1), datetime.min.time()))
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            (AuditLog.actor_name.ilike(like)) |
            (AuditLog.description.ilike(like)) |
            (AuditLog.entity_type.ilike(like)) |
            (AuditLog.tenant_name.ilike(like))
        )

    total = db.scalar(select(func.count()).select_from(stmt.subquery()))

    rows = db.scalars(
        stmt.order_by(desc(AuditLog.created_at)).offset((page - 1) * page_size).limit(page_size)
    ).all()

    return {
        "total": total or 0,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": str(r.id),
                "tenant_id": str(r.tenant_id) if r.tenant_id else None,
                "tenant_name": r.tenant_name,
                "actor_type": r.actor_type,
                "actor_id": r.actor_id,
                "actor_name": r.actor_name,
                "action": r.action,
                "entity_type": r.entity_type,
                "entity_id": r.entity_id,
                "amount": float(r.amount) if r.amount is not None else None,
                "before_values": r.before_values,
                "after_values": r.after_values,
                "description": r.description,
                "ip_address": r.ip_address,
                "created_at": r.created_at.isoformat(),
            } for r in rows
        ]
    }


@router.get("/actions")
def list_distinct_actions(
    db: Session = Depends(get_master_db),
    current_admin: SuperAdmin = Depends(get_current_super_admin)
):
    """Distinct action/entity_type values seen so far, to populate filter dropdowns."""
    actions = db.scalars(select(AuditLog.action).distinct().order_by(AuditLog.action)).all()
    entity_types = db.scalars(select(AuditLog.entity_type).distinct().where(AuditLog.entity_type.is_not(None)).order_by(AuditLog.entity_type)).all()
    return {"actions": list(actions), "entity_types": list(entity_types)}
