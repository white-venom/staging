"""
FINAL clean sync: Match ONLY by name (+ mapped names). Create missing entries.
No phone matching to avoid cross-contamination.
"""
import os, sys, uuid
sys.path.insert(0, '/app')

from datetime import date
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database.db import get_tenant_connection_string
from app.database.models import Retailer
from app.logic.ledger import recalculate_balances
from scripts.seed_hello import RETAILERS_TO_SEED

TARGET_DB = "crediiflow_hello"
TARGET_DATE = date(2026, 9, 7)

NAME_MAPPING = {
    "gagan cyber care rinkesh": "gagan cyber cafe",
    "guru ji garakh sewa kendra mohit": "guruji grahak sewa kendra mohit",
    "cdm stuck details": "cdm stuck",
}


def final_clean_sync():
    print(f"FINAL CLEAN SYNC: ALL 287 Khatabook -> {TARGET_DB}")

    engine = create_engine(get_tenant_connection_string(TARGET_DB))
    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        all_retailers = db.query(Retailer).all()
        db_by_name = {r.retailer_name.strip().lower(): r for r in all_retailers}
        used_phones = {r.phone.strip() for r in all_retailers if r.phone}

        updated = 0
        created = 0
        
        for seed in RETAILERS_TO_SEED:
            seed_name = seed['name'].strip()
            seed_key = seed_name.lower()
            seed_take = Decimal(str(seed['take']))
            seed_give = Decimal(str(seed['give']))

            # Find by name or mapped name ONLY
            target = db_by_name.get(seed_key)
            if not target and seed_key in NAME_MAPPING:
                target = db_by_name.get(NAME_MAPPING[seed_key])

            if target:
                target.opening_to_take = seed_take
                target.opening_to_give = seed_give
                target.opening_balance_set_on = TARGET_DATE
                updated += 1
            else:
                # Create new - generate unique phone
                phone = seed['phone'].strip()
                while phone in used_phones:
                    phone = f"9{uuid.uuid4().hex[:9]}"
                used_phones.add(phone)
                
                new_r = Retailer(
                    retailer_name=seed_name,
                    phone=phone,
                    address="New Delhi",
                    opening_to_take=seed_take,
                    opening_to_give=seed_give,
                    balance=Decimal("0"),
                    opening_balance_set_on=TARGET_DATE,
                    is_active=True
                )
                db.add(new_r)
                created += 1
                print(f"  NEW: '{seed_name}' T={seed['take']:,.0f} G={seed['give']:,.0f}")

        # Set date for ALL retailers
        for r in db.query(Retailer).all():
            if r.opening_balance_set_on != TARGET_DATE:
                r.opening_balance_set_on = TARGET_DATE

        db.flush()

        # Recalculate all balances
        print("\nRecalculating all balances...")
        all_retailers = db.query(Retailer).all()
        for r in all_retailers:
            recalculate_balances(r.id, db)
        db.commit()

        # Verification
        all_retailers = db.query(Retailer).all()
        total_give = sum(float(r.balance) for r in all_retailers if r.balance > 0)
        total_take = sum(float(-r.balance) for r in all_retailers if r.balance < 0)
        seed_take = sum(r['take'] for r in RETAILERS_TO_SEED)
        seed_give = sum(r['give'] for r in RETAILERS_TO_SEED)

        print(f"\n{'='*60}")
        print(f"Updated: {updated} | Created: {created}")
        print(f"Total retailers: {len(all_retailers)}")
        print(f"\nDashboard:")
        print(f"  You will give: Rs {total_give:,.0f}  (Khatabook: {seed_give:,.0f}) {'MATCH!' if abs(total_give - seed_give) < 1 else f'DIFF: {total_give - seed_give:,.0f}'}")
        print(f"  You will get:  Rs {total_take:,.0f}  (Khatabook: {seed_take:,.0f}) {'MATCH!' if abs(total_take - seed_take) < 1 else f'DIFF: {total_take - seed_take:,.0f}'}")
        print(f"  Date: {TARGET_DATE}")

        # Spot check key entries
        print("\nSpot check (top entries):")
        checks = ['CASH PORTAL', 'SELF', 'Yarana Tour', 'Ashraf Bhai', 'Sachin Bhai Khichra',
                   'Cms Collection', 'Iifl Gold Loan', 'Od Rinova', 'Portal Reli Pay']
        for name in checks:
            r = db.query(Retailer).filter(Retailer.retailer_name == name).first()
            if r:
                print(f"  {r.retailer_name}: T={float(r.opening_to_take):,.0f} G={float(r.opening_to_give):,.0f} Bal={float(r.balance):,.0f}")
            else:
                print(f"  {name}: NOT FOUND")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
        engine.dispose()


if __name__ == "__main__":
    final_clean_sync()
