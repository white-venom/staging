"""Item #3: detects whether a staff member's Collection can no longer be safely
edited/deleted because its cash has already been spent through a later cash-out.

Cash-in-hand is a POOLED "honest sum" per staff (see reports.py's
get_staff_cash_in_hand): collected + received - deposited, replayed
chronologically, with no per-transaction earmarking between a specific
collection and a specific later deposit. There is no FIFO lineage anywhere in
this system to trace "this deposit's rupees came from that collection" -- so
the only detection rule consistent with how the pool is actually computed
elsewhere is a threshold check: a collection's contribution has necessarily
been spent once the pool, at any point afterward, returns to (or below) the
level it was at right before that collection was added.
"""
from datetime import datetime, timedelta
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import select, and_
from sqlalchemy.orm import Session

from app.database.models import Collection, BankDeposit


def enforce_deposit_edit_lock(deposit: BankDeposit, current_user, tenant, action: str) -> None:
    """Item #3: same time-window gate as enforce_collection_edit_lock, for
    BankDeposit rows. Deposits don't get the downstream-use lock -- that rule
    is specifically about protecting a Collection whose cash already moved on
    through a later deposit, not the deposit itself."""
    if tenant is None or not tenant.time_window_lock_enabled:
        return

    is_admin = getattr(current_user, "role", None) == "admin"
    if action == "delete":
        window = tenant.admin_delete_window_minutes if is_admin else tenant.delete_window_minutes
    else:
        window = tenant.admin_edit_window_minutes if is_admin else tenant.edit_window_minutes

    if window != -1 and datetime.utcnow() - deposit.created_at > timedelta(minutes=window):
        who = "Admins" if is_admin else "Staff"
        raise HTTPException(
            status_code=403,
            detail=f"{who} can only {action} deposits within {window} minutes of creation."
        )


def is_collection_locked_by_downstream_use(collection: Collection, db: Session) -> bool:
    staff_id = collection.staff_id
    if not staff_id:
        return False

    # Same three pool-affecting buckets as /reports/staff/cash-in-hand, but by
    # total amount (not per-denomination -- locking on a single note type
    # dipping would make almost everything lock near-instantly) and including
    # every Collection row for this staff (both real collections and
    # staff-to-staff handover mirrors), since both add to the same pocket.
    collections = db.scalars(
        select(Collection).where(Collection.staff_id == staff_id, Collection.from_staff_id.is_(None))
    ).all()
    received = db.scalars(
        select(BankDeposit).where(
            and_(BankDeposit.recipient_staff_id == staff_id, BankDeposit.deposit_type == "staff")
        )
    ).all()
    deposited = db.scalars(
        select(BankDeposit).where(BankDeposit.staff_id == staff_id)
    ).all()

    # Single signed, chronologically-ordered event list. Each event carries
    # whether it IS the collection being checked, to find its exact position
    # even when timestamps tie.
    signed_events = []
    for c in collections:
        signed_events.append((c.created_at, c.id, Decimal(str(c.total_amount)), c.id == collection.id))
    for r in received:
        signed_events.append((r.created_at, r.id, Decimal(str(r.amount)), False))
    for d in deposited:
        signed_events.append((d.created_at, d.id, -Decimal(str(d.amount)), False))
    signed_events.sort(key=lambda e: (e[0], e[1]))

    running = Decimal("0.00")
    running_before_target = None
    after_target = False
    min_after = None

    for created_at, _id, delta, is_target in signed_events:
        if is_target:
            running_before_target = running
        running += delta
        if is_target:
            after_target = True
            continue
        if after_target:
            min_after = running if min_after is None else min(min_after, running)

    if running_before_target is None or min_after is None:
        # Either this collection isn't in the pool at all, or nothing has
        # happened after it yet -- can't have been used downstream.
        return False

    return min_after <= running_before_target


def enforce_collection_edit_lock(collection: Collection, current_user, tenant, action: str, db: Session) -> None:
    """Item #3: shared edit/delete gate for a Collection. `action` is "edit" or
    "delete". Raises HTTPException(403) if blocked, otherwise returns silently.

    Ownership (a staff member may only touch their own collections) is
    enforced by the caller beforehand -- this only covers the time window and
    the downstream-use lock, both of which apply to admins too (the whole
    point of the downstream lock is protecting cash integrity, not
    authorization, so it isn't role-gated).
    """
    if tenant is None or not tenant.time_window_lock_enabled:
        return

    is_admin = getattr(current_user, "role", None) == "admin"
    if action == "delete":
        window = tenant.admin_delete_window_minutes if is_admin else tenant.delete_window_minutes
    else:
        window = tenant.admin_edit_window_minutes if is_admin else tenant.edit_window_minutes

    if window != -1 and datetime.utcnow() - collection.created_at > timedelta(minutes=window):
        who = "Admins" if is_admin else "Staff"
        raise HTTPException(
            status_code=403,
            detail=f"{who} can only {action} collections within {window} minutes of creation."
        )

    if is_collection_locked_by_downstream_use(collection, db):
        raise HTTPException(
            status_code=403,
            detail="This collection's cash has already been used in a later cash-out/deposit, "
                   "so it's locked to protect denomination accuracy. Contact an admin if this needs correcting."
        )
