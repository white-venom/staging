"""
Final sync: Add ALL 287 Khatabook entries as opening balances to do-it-services tenant.
- Matches by name (case-insensitive) OR phone number
- Creates missing entries
- Sets all opening_balance_set_on to 7 Sept 2026
- Recalculates all balances
"""
import os, sys
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

# Near-name mappings: seed_name_lower -> db_name_lower
NAME_MAPPING = {
    "gagan cyber care rinkesh": "gagan cyber cafe",
    "guru ji garakh sewa kendra mohit": "guruji grahak sewa kendra mohit",
    "cdm stuck details": "cdm stuck",
}


def final_sync():
    print(f"Final sync: ALL Khatabook entries -> {TARGET_DB} (date: {TARGET_DATE})")

    engine = create_engine(get_tenant_connection_string(TARGET_DB))
    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        all_retailers = db.query(Retailer).all()
        db_by_name = {r.retailer_name.strip().lower(): r for r in all_retailers}
        db_by_phone = {r.phone.strip(): r for r in all_retailers if r.phone}

        updated = 0
        created = 0
        already_correct = 0

        for seed in RETAILERS_TO_SEED:
            seed_name = seed['name'].strip()
            seed_key = seed_name.lower()
            seed_phone = seed['phone'].strip()
            seed_take = Decimal(str(seed['take']))
            seed_give = Decimal(str(seed['give']))

            # Try to find existing retailer: by name, mapped name, or phone
            target = None

            # 1. Direct name match
            if seed_key in db_by_name:
                target = db_by_name[seed_key]
            # 2. Mapped name match
            elif seed_key in NAME_MAPPING:
                mapped_key = NAME_MAPPING[seed_key]
                if mapped_key in db_by_name:
                    target = db_by_name[mapped_key]
            # 3. Phone match
            if not target and seed_phone in db_by_phone:
                target = db_by_phone[seed_phone]

            if target:
                # Check if already correct
                if (target.opening_to_take == seed_take and 
                    target.opening_to_give == seed_give and
                    target.opening_balance_set_on == TARGET_DATE):
                    already_correct += 1
                else:
                    target.opening_to_take = seed_take
                    target.opening_to_give = seed_give
                    target.opening_balance_set_on = TARGET_DATE
                    updated += 1
                    print(f"  Updated '{target.retailer_name}': T={seed['take']:,.0f} G={seed['give']:,.0f}")
            else:
                # Create new retailer
                import uuid
                # Use seed phone if unique, otherwise generate
                phone = seed_phone
                if phone in db_by_phone:
                    phone = f"99999{uuid.uuid4().hex[:5]}"

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
                db_by_phone[phone] = new_r  # prevent future duplicates
                created += 1
                print(f"  Created '{seed_name}': T={seed['take']:,.0f} G={seed['give']:,.0f}")

        # Also set date for all existing retailers that were already correct
        for r in all_retailers:
            if r.opening_balance_set_on != TARGET_DATE:
                r.opening_balance_set_on = TARGET_DATE

        db.flush()

        # Recalculate all balances
        print("\nRecalculating all balances...")
        all_retailers = db.query(Retailer).all()
        for r in all_retailers:
            recalculate_balances(r.id, db)
        db.commit()

        # Final verification
        all_retailers = db.query(Retailer).all()
        total_give = sum(float(r.balance) for r in all_retailers if r.balance > 0)
        total_take = sum(float(-r.balance) for r in all_retailers if r.balance < 0)

        # Seed totals for comparison
        seed_take_total = sum(r['take'] for r in RETAILERS_TO_SEED)
        seed_give_total = sum(r['give'] for r in RETAILERS_TO_SEED)

        print(f"\n{'='*60}")
        print(f"Updated: {updated} | Created: {created} | Already correct: {already_correct}")
        print(f"Total retailers: {len(all_retailers)}")
        print(f"\nDashboard totals:")
        print(f"  You will give: Rs {total_give:,.0f}  (Khatabook: {seed_give_total:,.0f})")
        print(f"  You will get:  Rs {total_take:,.0f}  (Khatabook: {seed_take_total:,.0f})")
        
        give_match = "MATCH" if abs(total_give - seed_give_total) < 1 else f"DIFF: {total_give - seed_give_total:,.0f}"
        take_match = "MATCH" if abs(total_take - seed_take_total) < 1 else f"DIFF: {total_take - seed_take_total:,.0f}"
        print(f"  Give: {give_match}")
        print(f"  Take: {take_match}")
        print(f"\nAll dates set to: {TARGET_DATE}")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
        engine.dispose()


if __name__ == "__main__":
    final_sync()
