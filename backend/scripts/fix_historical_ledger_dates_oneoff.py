"""
One-off, manually-invoked correction for ledger entries whose `created_at` date
doesn't match their linked collection/deposit's business date (a historical symptom
of the UTC-vs-IST "today" bug that has since been fixed at the source). This used to
run automatically on every backend startup (see app/main.py); it has been removed
from there because it scanned every ledger row of every tenant on every restart,
racing against live traffic with no row locking.

This script does NOT delete any rows. It only corrects `Ledger.created_at` timestamps
and recomputes derived `balance` fields via the existing `recalculate_balances()` logic.

Usage:
    python scripts/fix_historical_ledger_dates_oneoff.py              # dry run (reports only)
    python scripts/fix_historical_ledger_dates_oneoff.py --apply      # actually applies the fix
    python scripts/fix_historical_ledger_dates_oneoff.py --apply --subdomain do-it-services
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
from app.database.models import Ledger
from app.logic.migration import fix_historical_ledger_dates


def dry_run_report(db) -> int:
    ledgers = db.scalars(select(Ledger)).all()
    mismatched = []
    for ledger in ledgers:
        expected_date = None
        if ledger.collection:
            expected_date = ledger.collection.collection_date
        elif ledger.deposit:
            expected_date = ledger.deposit.deposit_date
        if expected_date and ledger.created_at.date() != expected_date:
            mismatched.append((ledger.id, ledger.retailer_id, ledger.created_at, expected_date))

    if not mismatched:
        print("  No mismatched ledger entries found.")
        return 0

    affected_retailers = {m[1] for m in mismatched}
    print(f"  {len(mismatched)} mismatched ledger entr{'y' if len(mismatched) == 1 else 'ies'} "
          f"across {len(affected_retailers)} retailer(s).")
    for ledger_id, retailer_id, created_at, expected_date in mismatched[:10]:
        print(f"    Ledger {ledger_id} (retailer {retailer_id}): created_at={created_at} -> expected date={expected_date}")
    if len(mismatched) > 10:
        print(f"    ... and {len(mismatched) - 10} more.")
    return len(mismatched)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Actually apply the fix (default is dry-run/report only).")
    parser.add_argument("--subdomain", default=None, help="Only process this tenant subdomain (default: all active tenants).")
    args = parser.parse_args()

    master_db = MasterSessionLocal()
    try:
        query = select(Tenant).where(Tenant.status == "active")
        tenants = master_db.scalars(query).all()
        if args.subdomain:
            tenants = [t for t in tenants if t.subdomain == args.subdomain]
            if not tenants:
                print(f"No active tenant found with subdomain '{args.subdomain}'.")
                return
    finally:
        master_db.close()

    total_mismatched = 0
    for tenant in tenants:
        print(f"\nTenant: {tenant.subdomain}")
        tenant_db = get_tenant_session(tenant.subdomain)
        try:
            if args.apply:
                fix_historical_ledger_dates(tenant_db)
            else:
                total_mismatched += dry_run_report(tenant_db)
        finally:
            tenant_db.close()

    if not args.apply:
        print(f"\nDry run complete. {total_mismatched} mismatched entr{'y' if total_mismatched == 1 else 'ies'} total.")
        print("Re-run with --apply to fix them (this updates created_at/balance fields only, never deletes rows).")


if __name__ == "__main__":
    main()
