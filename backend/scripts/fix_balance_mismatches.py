"""
Fix all balance mismatches and unmatched retailers in crediiflow_hello.
Corrects the 5 wrong balances, matches near-name retailers, and creates missing entries.
"""
import os, sys
sys.path.insert(0, '/app')

from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database.db import get_tenant_connection_string
from app.database.models import Retailer
from app.logic.ledger import recalculate_balances
from scripts.seed_hello import RETAILERS_TO_SEED

TARGET_DB = "crediiflow_hello"

# --- 1. Direct balance fixes (5 mismatched entries) ---
BALANCE_FIXES = {
    "cms collection": {"take": 0.0, "give": 33082.0},
    "nitish bhati reli pay portal": {"take": 429.0, "give": 0.0},
    "ankit communication": {"take": 0.0, "give": 0.0},
    "ashraf bhai": {"take": 0.0, "give": 300000.0},
    "sachin bhai khichra": {"take": 100000.0, "give": 0.0},
}

# --- 2. Name mapping: seed name -> DB name (near-matches) ---
NAME_MAPPING = {
    "gagan cyber care rinkesh": "gagan cyber cafe",
    "guru ji garakh sewa kendra mohit": "guruji grahak sewa kendra mohit",
    "cdm stuck details": "cdm stuck",
    "neetu pal rahul cyber cafer": None,  # not in DB, skip or create
}

# --- 3. Seed entries that are actually Portals (not retailers) - skip these ---
PORTAL_ENTRIES = {
    "portal parvej telecom rinova",
    "portal airtel payment bank",
    "portal reli pay",
    "portal sekure pay",
    "portal rinova pay",
    "portal paynearby",
    "portal soul pay",
    "portal paygrt",
    "portal imps guru",
    "super sekure pay portal",
    "portal appar service",
    "portal go payment",
    "portal vidcom",
    "portal k1 pay",
    "jaharveer portal",
    "vikas rinova portal hasan pur",
}


def fix_balances():
    print(f"Fixing balances in {TARGET_DB}...")

    engine = create_engine(get_tenant_connection_string(TARGET_DB))
    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        all_retailers = db.query(Retailer).all()
        db_by_name = {r.retailer_name.strip().lower(): r for r in all_retailers}

        seed_by_name = {r['name'].strip().lower(): r for r in RETAILERS_TO_SEED}

        fixed = 0
        created = 0
        skipped_portals = 0

        # Step 1: Fix the 5 mismatched balances
        print("\n--- Step 1: Fixing mismatched balances ---")
        for name_key, correct in BALANCE_FIXES.items():
            r = db_by_name.get(name_key)
            if r:
                old_take = float(r.opening_to_take or 0)
                old_give = float(r.opening_to_give or 0)
                r.opening_to_take = Decimal(str(correct["take"]))
                r.opening_to_give = Decimal(str(correct["give"]))
                print(f"  Fixed '{r.retailer_name}': T={old_take:,.0f}->{correct['take']:,.0f} G={old_give:,.0f}->{correct['give']:,.0f}")
                fixed += 1
            else:
                print(f"  NOT FOUND: {name_key}")

        # Step 2: Fix name-mapped entries
        print("\n--- Step 2: Fixing near-name matches ---")
        for seed_key, db_key in NAME_MAPPING.items():
            if db_key is None:
                continue
            seed_data = seed_by_name.get(seed_key)
            db_r = db_by_name.get(db_key)
            if seed_data and db_r:
                db_r.opening_to_take = Decimal(str(seed_data["take"]))
                db_r.opening_to_give = Decimal(str(seed_data["give"]))
                print(f"  Mapped '{seed_data['name']}' -> '{db_r.retailer_name}': T={seed_data['take']:,.0f} G={seed_data['give']:,.0f}")
                fixed += 1
            else:
                print(f"  Could not map: {seed_key} -> {db_key}")

        # Step 3: Fix missing non-portal entries (match by phone if name didn't match)
        print("\n--- Step 3: Fixing missing non-portal retailers ---")
        db_by_phone = {r.phone.strip(): r for r in all_retailers if r.phone}

        for seed in RETAILERS_TO_SEED:
            seed_key = seed['name'].strip().lower()
            # Skip if already in DB by name, skip portals, skip name-mapped
            if seed_key in db_by_name:
                continue
            if seed_key in PORTAL_ENTRIES:
                skipped_portals += 1
                continue
            if seed_key in NAME_MAPPING:
                continue

            # Try matching by phone number
            phone_match = db_by_phone.get(seed['phone'].strip())
            if phone_match:
                # Update existing retailer's opening balances
                phone_match.opening_to_take = Decimal(str(seed['take']))
                phone_match.opening_to_give = Decimal(str(seed['give']))
                print(f"  Phone-matched '{seed['name']}' -> '{phone_match.retailer_name}': T={seed['take']:,.0f} G={seed['give']:,.0f}")
                fixed += 1
            elif seed['take'] > 0 or seed['give'] > 0:
                # Create new retailer with unique phone
                import uuid
                unique_phone = f"99999{uuid.uuid4().hex[:5]}"
                new_r = Retailer(
                    retailer_name=seed['name'].strip(),
                    phone=unique_phone,
                    address="New Delhi",
                    opening_to_take=Decimal(str(seed['take'])),
                    opening_to_give=Decimal(str(seed['give'])),
                    balance=Decimal("0"),
                    is_active=True
                )
                db.add(new_r)
                print(f"  Created '{seed['name']}': T={seed['take']:,.0f} G={seed['give']:,.0f}")
                created += 1

        db.flush()

        # Step 4: Recalculate all retailer balances
        print("\n--- Step 4: Recalculating all balances ---")
        all_retailers = db.query(Retailer).all()
        for r in all_retailers:
            recalculate_balances(r.id, db)
        db.commit()

        # Final totals
        all_retailers = db.query(Retailer).all()
        total_give = sum(float(r.balance) for r in all_retailers if r.balance > 0)
        total_take = sum(float(-r.balance) for r in all_retailers if r.balance < 0)

        print(f"\n{'='*60}")
        print(f"Fixed: {fixed} | Created: {created} | Skipped portals: {skipped_portals}")
        print(f"Dashboard totals now:")
        print(f"  You will give: Rs {total_give:,.0f}")
        print(f"  You will get:  Rs {total_take:,.0f}")
        print(f"  Total retailers: {len(all_retailers)}")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()
        engine.dispose()


if __name__ == "__main__":
    fix_balances()
