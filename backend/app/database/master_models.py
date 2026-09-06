import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, DateTime, Boolean, Numeric, Integer, UniqueConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.database.db import Base
from decimal import Decimal

def utc_now():
    return datetime.now(timezone.utc)

class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    subdomain: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    db_name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False) # 'active', 'suspended'
    maintenance_mode: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    # Staff entry edit/delete windows (minutes, -1 = unlimited). Superadmin-only,
    # per-tenant -- moved here from each tenant's own business_settings table so
    # a tenant admin can no longer see or change it themselves (see item #2).
    edit_window_minutes: Mapped[int] = mapped_column(Integer, default=10, server_default="10", nullable=False)
    delete_window_minutes: Mapped[int] = mapped_column(Integer, default=10, server_default="10", nullable=False)

    # Item #3: admin gets its own (longer) window -- previously admins had NO
    # time limit at all on editing/deleting collections or deposits. Gated as
    # one whole-feature toggle so a tenant can be reverted to "no time limits
    # at all" instantly if the new enforcement causes friction.
    time_window_lock_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)
    admin_edit_window_minutes: Mapped[int] = mapped_column(Integer, default=30, server_default="30", nullable=False)
    admin_delete_window_minutes: Mapped[int] = mapped_column(Integer, default=30, server_default="30", nullable=False)

    # When False (default), a tenant's own admin cannot edit Retailer/Staff/Store
    # records or adjust a retailer's balance directly -- that becomes a
    # superadmin-only capability for this tenant. Superadmin can flip this back
    # on per tenant if they want to delegate it back to that tenant's admin.
    tenant_admin_can_edit_entities: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

class SuperAdmin(Base):
    __tablename__ = "super_admins"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    # 'full' = every superadmin capability. 'support' = read-only: can view
    # tenants/audit log/health but cannot create/edit/delete/suspend tenants,
    # cannot change feature flags or controls, cannot impersonate. See item #3d.
    role: Mapped[str] = mapped_column(String(20), default="full", server_default="full", nullable=False)
    # Profile fields (superadmin profile-edit feature). email doubles as the
    # forgot-password OTP destination -- unique so an OTP request unambiguously
    # resolves to one account (Postgres allows multiple NULLs under UNIQUE).
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    # Bumped on every password reset; embedded in the JWT at login and checked
    # on every request (see get_current_super_admin) so a reset immediately
    # invalidates every token issued before it -- JWTs are otherwise stateless
    # and don't expire early on their own.
    token_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)


class SuperAdminPasswordReset(Base):
    """Forgot-password OTP records. One row per requested OTP; superseded rows
    are left in place (not deleted) so they double as the rate-limit signal --
    counting rows created in the last 15 minutes needs no separate table."""
    __tablename__ = "super_admin_password_resets"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    super_admin_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("super_admins.id", ondelete="CASCADE"), nullable=False, index=True)
    otp_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Brute-force guard on top of the 10-minute expiry: a 6-digit OTP is only
    # ~1M possibilities, guessable well within that window without this. Burns
    # the OTP (used=True) after 5 wrong guesses, same as expiring it.
    failed_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False, index=True)


class TenantFeatureFlags(Base):
    """Per-tenant on/off switches for individually-toggleable features -- lives
    in the master DB (like AuditLog) so superadmin can manage every tenant's
    flags without opening a connection to each tenant's own database.

    Absence of a row for (tenant_id, feature_key) means "enabled" (the safe
    default -- a brand new feature or a brand new tenant is never silently
    disabled just because no row exists yet); an explicit row is only ever
    written when a superadmin actually flips something off. See
    docs/FEATURE_FLAGS.md for the registry of known feature_key values and how
    to register a new one.
    """
    __tablename__ = "tenant_feature_flags"
    __table_args__ = (
        UniqueConstraint("tenant_id", "feature_key", name="uq_tenant_feature"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    feature_key: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    updated_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("super_admins.id", ondelete="SET NULL"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)


class AuditLog(Base):
    """Append-only, cross-tenant audit trail -- lives in the master DB (not a
    per-tenant DB) specifically so the superadmin panel can search/filter/sort
    across every tenant in one query instead of fanning out to N separate
    tenant databases. Rows are only ever inserted, never updated or deleted by
    application code -- this is the source of truth for "who did what when."
    """
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    # Denormalized tenant identity -- snapshotted at write time so log entries
    # stay readable even if a tenant is later renamed or deleted. tenant_id is
    # nullable to allow platform-level events with no single tenant (e.g. a
    # superadmin action against master-level state).
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(nullable=True, index=True)
    tenant_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # 'staff' | 'admin' | 'superadmin'
    actor_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    # UUID string -- deliberately not a FK: staff/admin ids live in a tenant DB,
    # superadmin ids live in this master DB, two different id spaces.
    actor_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    actor_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # e.g. 'login', 'collection.create', 'collection.update', 'collection.delete',
    # 'deposit.create', 'deposit.update', 'deposit.delete', 'virtual_transfer',
    # 'portal_transfer', 'staff_handover', 'retailer.update', 'staff.update', ...
    action: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    entity_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    entity_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    before_values: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    after_values: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False, index=True)


class TenantErrorLog(Base):
    """Stores uncaught application exceptions occurring within tenant context."""
    __tablename__ = "tenant_error_logs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tenant_subdomain: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    user_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    endpoint: Mapped[str] = mapped_column(String(255), nullable=False)
    method: Mapped[str] = mapped_column(String(10), nullable=False)
    error_message: Mapped[str] = mapped_column(String(500), nullable=False)
    stack_trace: Mapped[str] = mapped_column(String(4000), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False, index=True)


class ImpersonationTicket(Base):
    """Database-backed single-use impersonation tickets for multi-worker support."""
    __tablename__ = "impersonation_tickets"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    ticket_token: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    subdomain: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(100), nullable=False)
    user_role: Mapped[str] = mapped_column(String(20), default="admin", nullable=False)
    name: Mapped[str] = mapped_column(String(100), default="Admin", nullable=False)
    phone: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
