"""
Script to cleanup erroneous bank_account_id tags on pure cash collection records
(where retailer_id IS NOT NULL, bank_account_id IS NOT NULL, and online_amount == 0).

Usage:
    python scripts/cleanup_erroneous_collection_portals.py              # Dry run across all tenants
    python scripts/cleanup_erroneous_collection_portals.py --apply      # Apply fix to all tenants
    python scripts/cleanup_erroneous_collection_portals.py --tenant do-it-services --apply # Single tenant
    python scripts/cleanup_erroneous_collection_portals.py --db-url "sqlite:///local.db" --apply
"""
import argparse
import os
import sys
from decimal import Decimal

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlalchemy import select, and_, or_, create_engine
from sqlalchemy.orm import sessionmaker, joinedload
from app.database.models import Collection, Denomination, BankAccount


def process_session(tenant_label: str, db, apply_fix: bool) -> int:
    # Select all collections that have retailer_id NOT NULL, bank_account_id NOT NULL,
    # online_routing_deposit_id IS NULL, and where online_amount is 0 or NULL.
    stmt = (
        select(Collection)
        .options(joinedload(Collection.denominations), joinedload(Collection.bank_account))
        .where(
            and_(
                Collection.retailer_id.isnot(None),
                Collection.bank_account_id.isnot(None),
                Collection.online_routing_deposit_id.is_(None)
            )
        )
    )
    cols = db.scalars(stmt).all()

    affected_cols = []
    for c in cols:
        online_amt = c.denominations.online_amount if c.denominations else Decimal("0.00")
        if online_amt is None or online_amt == Decimal("0.00") or online_amt == 0:
            affected_cols.append(c)

    print(f"\n--- Tenant '{tenant_label}': Found {len(affected_cols)} erroneous collection entries ---")
    for c in affected_cols:
        bank_name = c.bank_account.bank_account_name if c.bank_account else str(c.bank_account_id)
        print(f"  [ID: {c.id}] Date: {c.collection_date} | Total: ₹{c.total_amount} | Online Amt: ₹0 | BankAccount: {bank_name}")
        if apply_fix:
            c.bank_account_id = None

    if apply_fix and len(affected_cols) > 0:
        db.commit()
        print(f"✅ [{'APPLIED' if apply_fix else 'DRY RUN'}] Tenant '{tenant_label}': Cleared bank_account_id on {len(affected_cols)} collection records.")
    elif not apply_fix and len(affected_cols) > 0:
        print(f"ℹ️  [DRY RUN] Run with --apply to fix these {len(affected_cols)} entries.")

    return len(affected_cols)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Apply fixes to database")
    parser.add_argument("--tenant", type=str, help="Specific tenant DB name to process")
    parser.add_argument("--db-url", type=str, help="Direct database connection URL")
    args = parser.parse_args()

    if args.db_url:
        engine = create_engine(args.db_url)
        SessionLocal = sessionmaker(bind=engine)
        with SessionLocal() as db:
            process_session(args.db_url, db, args.apply)
        return

    from app.database.db import MasterSessionLocal, get_tenant_session
    from app.database.master_models import Tenant

    if args.tenant:
        try:
            with get_tenant_session(args.tenant) as db:
                process_session(args.tenant, db, args.apply)
        except Exception as e:
            print(f"Error processing tenant '{args.tenant}': {e}")
        return

    try:
        master_db = MasterSessionLocal()
        tenants = master_db.scalars(select(Tenant).where(Tenant.status == "active")).all()
        print(f"Found {len(tenants)} active tenants.")
        master_db.close()
    except Exception as e:
        print(f"Could not connect to Master DB ({e}). Attempting default tenant execution...")
        # Fall back to default tenant or local db if Master DB is not configured
        try:
            from app.database.db import SessionLocal
            with SessionLocal() as db:
                process_session("default", db, args.apply)
            return
        except Exception as ex:
            print(f"Default tenant fallback failed: {ex}")
            return

    total_fixed = 0
    for tenant in tenants:
        try:
            with get_tenant_session(tenant.db_name) as db:
                count = process_session(tenant.name, db, args.apply)
                total_fixed += count
        except Exception as e:
            print(f"Error processing tenant '{tenant.name}' ({tenant.db_name}): {e}")

    print(f"\nCompleted! Total affected entries: {total_fixed} across {len(tenants)} tenants.")


if __name__ == "__main__":
    main()
