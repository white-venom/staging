"""
Script to fix opening balance timestamps and missing opening_balance_set_on dates
for all existing retailers.

Usage:
    python scripts/fix_opening_balance_timestamps.py              # Dry run
    python scripts/fix_opening_balance_timestamps.py --apply      # Apply fix
"""
import argparse
import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlalchemy import select
from app.database.db import MasterSessionLocal, get_tenant_session
from app.database.master_models import Tenant
from app.database.models import Retailer, Ledger
from app.logic.ledger import recalculate_balances
from app.core.timezone import ist_today


def process_tenant(db, apply_fix: bool) -> int:
    retailers = db.scalars(select(Retailer)).all()
    count = 0
    for r in retailers:
        net_opening = (r.opening_to_give or 0) - (r.opening_to_take or 0)
        if net_opening != 0:
            count += 1
            if apply_fix:
                if not r.opening_balance_set_on:
                    r.opening_balance_set_on = r.created_at.date()
                recalculate_balances(r.id, db)
    if apply_fix and count > 0:
        db.commit()
    return count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Apply fixes to database")
    args = parser.parse_args()

    master_db = MasterSessionLocal()
    try:
        tenants = master_db.scalars(select(Tenant).where(Tenant.status == "active")).all()
    finally:
        master_db.close()

    total = 0
    for tenant in tenants:
        print(f"Processing tenant: {tenant.subdomain}")
        tenant_db = get_tenant_session(tenant.subdomain)
        try:
            c = process_tenant(tenant_db, args.apply)
            total += c
            print(f"  Processed {c} retailer(s) with opening balances.")
        finally:
            tenant_db.close()

    print(f"\nDone. Mode: {'APPLIED' if args.apply else 'DRY RUN'}. Total retailers: {total}")


if __name__ == "__main__":
    main()
