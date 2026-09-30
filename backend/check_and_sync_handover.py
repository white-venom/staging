import os
import sys
from decimal import Decimal
from datetime import date, datetime, timezone
from sqlalchemy import select, delete, and_, or_

# Ensure app can be imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database.db import get_tenant_session
from app.database.models import Collection, BankDeposit, Denomination, Ledger, User

def check_and_sync():
    db = get_tenant_session("do-it-services")
    try:
        # 1. Find Parvej Ali and DO iT OFFICE users
        users = db.scalars(select(User)).all()
        parvej = next((u for u in users if "parvej" in (u.name or "").lower()), None)
        office = next((u for u in users if "office" in (u.name or "").lower()), None)

        if not parvej:
            print("ERROR: Parvej Ali user not found!")
            return
        if not office:
            print("ERROR: DO iT OFFICE user not found!")
            return

        print(f"Found Sender Staff: {parvej.name} (ID: {parvej.id})")
        print(f"Found Recipient Staff: {office.name} (ID: {office.id})")

        target_amount = Decimal("194182.00")
        target_date = date(2026, 9, 29)

        # 2. Check existing collections of 194182
        cols = db.scalars(
            select(Collection).where(
                and_(
                    Collection.total_amount == target_amount,
                    or_(Collection.collection_date == target_date, Collection.collection_date == date(2026, 9, 30))
                )
            )
        ).all()

        # 3. Check existing deposits of 194182
        deps = db.scalars(
            select(BankDeposit).where(
                and_(
                    BankDeposit.amount == target_amount,
                    or_(BankDeposit.deposit_date == target_date, BankDeposit.deposit_date == date(2026, 9, 30))
                )
            )
        ).all()

        print(f"Found {len(cols)} existing collections of ₹{target_amount}")
        print(f"Found {len(deps)} existing deposits of ₹{target_amount}")

        # Keep at most 1 collection and 1 deposit, delete any extra duplicates
        keep_col = cols[0] if cols else None
        if len(cols) > 1:
            for extra_col in cols[1:]:
                db.execute(delete(Ledger).where(Ledger.collection_id == extra_col.id))
                db.execute(delete(Denomination).where(Denomination.collection_id == extra_col.id))
                db.delete(extra_col)
            print(f"Deleted {len(cols) - 1} duplicate collections")

        keep_dep = deps[0] if deps else None
        if len(deps) > 1:
            for extra_dep in deps[1:]:
                db.execute(delete(Ledger).where(Ledger.deposit_id == extra_dep.id))
                db.execute(delete(Denomination).where(Denomination.deposit_id == extra_dep.id))
                db.delete(extra_dep)
            print(f"Deleted {len(deps) - 1} duplicate deposits")

        # Denomination values
        denoms_data = {
            "note_500": 277,
            "note_200": 138,
            "note_100": 258,
            "note_50": 40,
            "note_20": 6,
            "note_10": 5,
            "coins": Decimal("112.00"),
            "online_amount": Decimal("0.00")
        }

        # 4. If deposit does not exist, create exactly 1
        if not keep_dep:
            print("Creating 1 BankDeposit (Cash Out) for Parvej Ali...")
            keep_dep = BankDeposit(
                staff_id=parvej.id,
                deposit_type="staff",
                recipient_staff_id=office.id,
                to_office=True,
                payment_mode="cash",
                amount=target_amount,
                deposit_date=target_date,
                status="verified",
                remarks="Handover to DO iT OFFICE",
                balance_snapshot=Decimal("0.00")
            )
            db.add(keep_dep)
            db.flush()
            db.add(Denomination(deposit_id=keep_dep.id, **denoms_data))
        else:
            print("Updating existing BankDeposit to ensure date=2026-09-29 and links...")
            keep_dep.staff_id = parvej.id
            keep_dep.recipient_staff_id = office.id
            keep_dep.to_office = True
            keep_dep.deposit_date = target_date
            keep_dep.status = "verified"
            if keep_dep.denominations:
                for k, v in denoms_data.items():
                    setattr(keep_dep.denominations, k, v)
            else:
                db.add(Denomination(deposit_id=keep_dep.id, **denoms_data))

        # 5. If collection does not exist, create exactly 1
        if not keep_col:
            print("Creating 1 Collection (Cash In) for DO iT OFFICE...")
            keep_col = Collection(
                staff_id=office.id,
                from_staff_id=parvej.id,
                total_amount=target_amount,
                collection_date=target_date,
                status="verified",
                remarks="From Parvej Ali",
                mirror_deposit_id=keep_dep.id,
                balance_snapshot=Decimal("0.00")
            )
            db.add(keep_col)
            db.flush()
            db.add(Denomination(collection_id=keep_col.id, **denoms_data))
        else:
            print("Updating existing Collection to ensure date=2026-09-29 and links...")
            keep_col.staff_id = office.id
            keep_col.from_staff_id = parvej.id
            keep_col.collection_date = target_date
            keep_col.mirror_deposit_id = keep_dep.id
            keep_col.status = "verified"
            if keep_col.denominations:
                for k, v in denoms_data.items():
                    setattr(keep_col.denominations, k, v)
            else:
                db.add(Denomination(collection_id=keep_col.id, **denoms_data))

        # Ensure mirror link
        keep_col.mirror_deposit_id = keep_dep.id

        db.commit()
        print("\n================ SUCCESS ================")
        print(f"DATE: {target_date}")
        print(f"AMOUNT: ₹{target_amount}")
        print(f"PARVEJ ALI (OUT): BankDeposit ID={keep_dep.id}, Date={keep_dep.deposit_date}, Status={keep_dep.status}")
        print(f"DO iT OFFICE (IN): Collection ID={keep_col.id}, Date={keep_col.collection_date}, Status={keep_col.status}")
        print("Both sides are linked via mirror_deposit_id with exact denominations!")
        print("=========================================\n")

    except Exception as e:
        db.rollback()
        print(f"Error syncing handover: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_and_sync()
