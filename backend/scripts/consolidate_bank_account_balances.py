"""Item #8: verify (and, if needed, correct) that every Portal's balance already
equals the sum of its BankAccounts' historical balances, before the app stops
maintaining a per-BankAccount balance going forward.

Why this is a *verification* script, not a data-rewriting migration: every
place in the codebase that ever mutated `BankAccount.balance` already mutated
`BankAccount.portal.balance` by the exact same amount in the same transaction
(this was audited across collections.py, deposits.py, bank_accounts.py, and
admin_settings.py before writing this script). So Portal.balance should
already equal sum(BankAccount.balance) for every portal -- this script proves
that with a real, per-tenant scan of production data, and only touches
Portal.balance if it finds an actual mismatch (logged loudly either way).

Run this AFTER taking a fresh Postgres backup, and BEFORE deploying the code
change that stops writing to BankAccount.balance/opening_to_give/opening_to_take.

Usage:
    python backend/scripts/consolidate_bank_account_balances.py [--tenant SUBDOMAIN] [--apply]

Without --apply, this is fully read-only and only prints a report.
With --apply, any portal found with a mismatch has its balance corrected to
match the true sum of its bank accounts (and the correction is logged).
"""
import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from decimal import Decimal
from sqlalchemy import select
from app.database.db import MasterSessionLocal, get_tenant_session
from app.database.master_models import Tenant


def check_tenant(subdomain: str, apply: bool) -> tuple[int, int]:
    from app.database.models import Portal, BankAccount

    db = get_tenant_session(subdomain)
    mismatches = 0
    portals_checked = 0
    try:
        portals = db.scalars(select(Portal)).all()
        for portal in portals:
            portals_checked += 1
            accounts = db.scalars(select(BankAccount).where(BankAccount.portal_id == portal.id)).all()
            account_sum = sum((a.balance or Decimal("0.00")) for a in accounts)
            portal_balance = portal.balance or Decimal("0.00")

            if account_sum != portal_balance:
                mismatches += 1
                print(
                    f"  [MISMATCH] Portal '{portal.name}' ({portal.id}): "
                    f"Portal.balance={portal_balance}, sum(BankAccount.balance)={account_sum}, "
                    f"diff={portal_balance - account_sum}"
                )
                if apply:
                    portal.balance = account_sum
                    print(f"    -> corrected Portal.balance to {account_sum}")
            else:
                print(f"  [OK] Portal '{portal.name}': balance={portal_balance} matches {len(accounts)} bank account(s)")

        if apply and mismatches:
            db.commit()
            print(f"  Committed {mismatches} correction(s) for tenant '{subdomain}'.")
    finally:
        db.close()
    return portals_checked, mismatches


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tenant", help="Only check this tenant subdomain (default: all active tenants)")
    parser.add_argument("--apply", action="store_true", help="Correct any mismatched Portal.balance found (default: report only)")
    args = parser.parse_args()

    master_db = MasterSessionLocal()
    try:
        if args.tenant:
            tenants = master_db.query(Tenant).filter(Tenant.subdomain == args.tenant).all()
            if not tenants:
                print(f"No tenant found with subdomain '{args.tenant}'")
                return
        else:
            tenants = master_db.query(Tenant).filter(Tenant.status == "active").all()
    finally:
        master_db.close()

    print(f"{'APPLY MODE -- will correct mismatches' if args.apply else 'REPORT-ONLY MODE (pass --apply to correct)'}")
    print(f"Checking {len(tenants)} tenant(s)...\n")

    total_portals = 0
    total_mismatches = 0
    for tenant in tenants:
        print(f"Tenant: {tenant.name} ({tenant.subdomain})")
        checked, mismatches = check_tenant(tenant.subdomain, args.apply)
        total_portals += checked
        total_mismatches += mismatches
        print()

    print("=" * 60)
    print(f"Checked {total_portals} portal(s) across {len(tenants)} tenant(s).")
    print(f"Found {total_mismatches} mismatch(es).")
    if total_mismatches and not args.apply:
        print("Re-run with --apply to correct them.")
    elif not total_mismatches:
        print("Every Portal's balance already matches the sum of its BankAccounts. No migration needed.")


if __name__ == "__main__":
    main()
