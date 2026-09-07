"""
Complete Reset & Khatabook Sync for do-it-services (crediiflow_hello):
1. Reset ALL portals and bank accounts to 0 balance and 0 opening balances.
2. Delete all transaction entries (collections, deposits, ledgers, portal adjustments, attendance, denominations).
3. Reset user virtual balances to 0 and business opening cash to 0.
4. Sync ALL 287 Khatabook entries into retailers with opening_balance_set_on = 2026-09-07.
5. Recreate fresh Opening Balance ledger entries for all retailers.
6. Verify that Dashboard will show:
   - Retailer Give: Rs 6,358,180 | Take: Rs 6,358,180
   - Portal Give: Rs 0 | Take: Rs 0
   - Total Give: Rs 6,358,180 | Take: Rs 6,358,180
"""
import os
import sys
import uuid
from datetime import date
from decimal import Decimal
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database.db import get_tenant_connection_string
from app.database.models import (
    Retailer, Portal, BankAccount, User,
    Collection, BankDeposit, Ledger, Denomination, DenominationBaseline,
    PortalAdjustment, Attendance, BusinessSettings
)
from app.logic.ledger import recalculate_balances
from scripts.seed_hello import RETAILERS_TO_SEED

TARGET_DB = "crediiflow_hello"
TARGET_DATE = date(2026, 9, 7)

NAME_MAPPING = {
    "gagan cyber care rinkesh": "gagan cyber cafe",
    "guru ji garakh sewa kendra mohit": "guruji grahak sewa kendra mohit",
    "cdm stuck details": "cdm stuck",
}


def run_clean_reset_and_sync():
    print(f"🚀 Starting clean reset and Khatabook sync on {TARGET_DB}...")
    tenant_url = get_tenant_connection_string(TARGET_DB)
    engine = create_engine(tenant_url)
    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        # 1. Clear all transactions
        print("\n1. Deleting all transaction data...")
        db.execute(text("UPDATE collections SET mirror_deposit_id = NULL, online_routing_deposit_id = NULL"))
        db.query(Denomination).delete()
        db.query(DenominationBaseline).delete()
        db.query(Ledger).delete()
        db.query(Collection).delete()
        db.query(BankDeposit).delete()
        db.query(PortalAdjustment).delete()
        db.query(Attendance).delete()
        print("   ✅ Transactions, ledgers, adjustments, attendance deleted.")

        # 2. Reset ALL Portals to 0
        print("\n2. Resetting Portals to 0...")
        portals = db.query(Portal).all()
        for p in portals:
            p.opening_to_give = Decimal("0")
            p.opening_to_take = Decimal("0")
            p.balance = Decimal("0")
        print(f"   ✅ Reset {len(portals)} portals to 0 balance and 0 opening.")

        # 3. Reset ALL BankAccounts to 0
        print("\n3. Resetting Bank Accounts to 0...")
        bank_accounts = db.query(BankAccount).all()
        for ba in bank_accounts:
            ba.opening_to_give = Decimal("0")
            ba.opening_to_take = Decimal("0")
            ba.balance = Decimal("0")
        print(f"   ✅ Reset {len(bank_accounts)} bank accounts to 0.")

        # 4. Reset User virtual balances and BusinessSettings
        print("\n4. Resetting user virtual balances & business settings...")
        users = db.query(User).all()
        for u in users:
            u.virtual_balance = Decimal("0")
        biz = db.query(BusinessSettings).first()
        if biz:
            biz.opening_cash_in_hand = 0.0
        print(f"   ✅ Reset {len(users)} users and opening cash in hand.")

        db.flush()

        # 5. Sync Khatabook 287 entries into Retailers
        print("\n5. Syncing Khatabook entries to Retailers...")
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

            target = db_by_name.get(seed_key)
            if not target and seed_key in NAME_MAPPING:
                target = db_by_name.get(NAME_MAPPING[seed_key])

            if target:
                target.opening_to_take = seed_take
                target.opening_to_give = seed_give
                target.opening_balance_set_on = TARGET_DATE
                target.balance = Decimal("0")
                updated += 1
            else:
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
                db_by_name[seed_key] = new_r
                created += 1

        # Ensure all existing retailers have date 7 Sept 2026
        for r in db.query(Retailer).all():
            r.opening_balance_set_on = TARGET_DATE

        db.flush()
        print(f"   ✅ Retailers updated: {updated}, created: {created}")

        # 6. Recalculate ledger balances for all retailers
        print("\n6. Recalculating ledger balances for all retailers...")
        all_retailers = db.query(Retailer).all()
        for r in all_retailers:
            recalculate_balances(r.id, db)
        db.commit()
        print(f"   ✅ Opening balance ledger entries created for {len(all_retailers)} retailers.")

        # 7. Verification
        print(f"\n{'='*60}")
        print("VERIFICATION RESULTS:")
        print(f"{'='*60}")
        all_retailers = db.query(Retailer).all()
        all_portals = db.query(Portal).all()

        ret_give = sum(float(r.balance) for r in all_retailers if r.balance > 0)
        ret_take = sum(float(-r.balance) for r in all_retailers if r.balance < 0)

        # In frontend:
        # portalToTake = (portalDirectory || []).reduce((s, p) => s + (p.balance > 0 ? p.balance : 0), 0);
        # portalToGive = (portalDirectory || []).reduce((s, p) => s + (p.balance < 0 ? -p.balance : 0), 0);
        p_take = sum(float(p.balance) for p in all_portals if p.balance > 0)
        p_give = sum(float(-p.balance) for p in all_portals if p.balance < 0)

        total_give = ret_give + p_give
        total_take = ret_take + p_take

        seed_take = sum(r['take'] for r in RETAILERS_TO_SEED)
        seed_give = sum(r['give'] for r in RETAILERS_TO_SEED)

        print(f"Retailer Balances: You will give: ₹{ret_give:,.0f} | You will get: ₹{ret_take:,.0f}")
        print(f"Portal Balances:   You will give: ₹{p_give:,.0f} | You will get: ₹{p_take:,.0f}")
        print(f"TOTAL DASHBOARD:   You will give: ₹{total_give:,.0f} | You will get: ₹{total_take:,.0f}")
        print(f"KHATABOOK TARGET:  You will give: ₹{seed_give:,.0f} | You will get: ₹{seed_take:,.0f}")
        print(f"Date set on all:   {TARGET_DATE}")

        give_match = abs(total_give - seed_give) < 1
        take_match = abs(total_take - seed_take) < 1

        if give_match and take_match and p_give == 0 and p_take == 0:
            print("\n🎉 PERFECT MATCH! Dashboard will match Khatabook exactly!")
        else:
            print(f"\n⚠️ Mismatch detected: Give diff={total_give - seed_give}, Take diff={total_take - seed_take}")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Error during execution: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()
        engine.dispose()


if __name__ == "__main__":
    run_clean_reset_and_sync()
