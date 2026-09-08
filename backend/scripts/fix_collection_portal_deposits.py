import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select
from app.database.db import get_tenant_session
from app.database.models import Collection, BankDeposit


def fix_stale_routing_deposits(subdomain="do-it-services"):
    print(f"Checking linked online routing deposits for tenant: {subdomain}...")
    with get_tenant_session(subdomain) as db:
        cols = db.scalars(
            select(Collection).where(Collection.online_routing_deposit_id.is_not(None))
        ).all()
        print(f"Found {len(cols)} collections with online routing deposits.")
        fixed = 0
        for c in cols:
            dep = db.scalar(select(BankDeposit).where(BankDeposit.id == c.online_routing_deposit_id))
            if dep:
                changed = False
                if dep.retailer_id != c.retailer_id:
                    print(f"Fixing deposit {dep.id}: retailer_id {dep.retailer_id} -> {c.retailer_id}")
                    dep.retailer_id = c.retailer_id
                    changed = True
                if c.remarks and dep.remarks != c.remarks:
                    dep.remarks = c.remarks
                    changed = True
                if dep.deposit_date != c.collection_date:
                    dep.deposit_date = c.collection_date
                    changed = True
                if changed:
                    fixed += 1
        db.commit()
        print(f"Successfully updated {fixed} deposits.")


if __name__ == "__main__":
    subdomain = sys.argv[1] if len(sys.argv) > 1 else "do-it-services"
    fix_stale_routing_deposits(subdomain)
