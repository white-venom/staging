import os
import sys
from decimal import Decimal
from sqlalchemy import select, delete

# Ensure app can be imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database.db import MasterSessionLocal, get_tenant_session
from app.database.master_models import Tenant
from app.database.models import Collection, BankDeposit, Denomination, Ledger

def run_cleanup():
    target_amount = Decimal("194182")
    master_db = MasterSessionLocal()
    try:
        tenants = master_db.query(Tenant).filter(Tenant.status == 'active').all()
        for t in tenants:
            print(f"Checking tenant: {t.subdomain}")
            db = get_tenant_session(t.subdomain)
            try:
                # 1. Delete collections of target amount
                cols = db.scalars(
                    select(Collection).where(Collection.total_amount == target_amount)
                ).all()
                col_count = len(cols)
                for c in cols:
                    db.execute(delete(Ledger).where(Ledger.collection_id == c.id))
                    db.execute(delete(Denomination).where(Denomination.collection_id == c.id))
                    db.delete(c)

                # 2. Delete deposits of target amount
                deps = db.scalars(
                    select(BankDeposit).where(BankDeposit.amount == target_amount)
                ).all()
                dep_count = len(deps)
                for d in deps:
                    db.execute(delete(Ledger).where(Ledger.deposit_id == d.id))
                    db.execute(delete(Denomination).where(Denomination.deposit_id == d.id))
                    db.delete(d)

                db.commit()
                print(f"[{t.subdomain}] Successfully deleted {col_count} collections and {dep_count} deposits (Amount: ₹{target_amount})!")
            except Exception as e:
                db.rollback()
                print(f"[{t.subdomain}] Error during cleanup: {e}")
            finally:
                db.close()
    finally:
        master_db.close()
    print("ALL CLEANUP COMPLETED SUCCESSFULLY!")

if __name__ == "__main__":
    run_cleanup()
