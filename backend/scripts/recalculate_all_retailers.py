"""
Script to recalculate ledger balances for all retailers across active tenants,
applying the updated opening balance direction logic.

Usage:
    python scripts/recalculate_all_retailers.py              # Dry run across all tenants
    python scripts/recalculate_all_retailers.py --apply      # Apply fix to all tenants
    python scripts/recalculate_all_retailers.py --tenant do-it-services --apply # Single tenant
    python scripts/recalculate_all_retailers.py --db-url "sqlite:///local.db" --apply
"""
import argparse
import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlalchemy import select, create_engine
from sqlalchemy.orm import sessionmaker
from app.database.models import Retailer
from app.logic.ledger import recalculate_balances


def process_session(tenant_label: str, db, apply_fix: bool) -> int:
    retailers = db.scalars(select(Retailer)).all()
    count = 0
    for r in retailers:
        count += 1
        if apply_fix:
            recalculate_balances(r.id, db)
    if apply_fix and count > 0:
        db.commit()
    print(f"[{'APPLIED' if apply_fix else 'DRY RUN'}] Tenant '{tenant_label}': Processed {count} retailers.")
    return count


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
        print(f"Could not connect to Master DB ({e}).")
        print("Note: When deploying to production server, run: python scripts/recalculate_all_retailers.py --apply")
        return

    total_retailers = 0
    for tenant in tenants:
        try:
            with get_tenant_session(tenant.db_name) as db:
                count = process_session(tenant.name, db, args.apply)
                total_retailers += count
        except Exception as e:
            print(f"Error processing tenant '{tenant.name}' ({tenant.db_name}): {e}")

    print(f"\nCompleted! Processed total {total_retailers} retailers across {len(tenants)} tenants.")


if __name__ == "__main__":
    main()
