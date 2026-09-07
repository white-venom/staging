"""
Move CASH PORTAL from Portals to Retailers:
1. Delete CASH PORTAL from `portals` table (cascades its bank account).
2. Create/update CASH PORTAL in `retailers` table with opening_to_take=671657, opening_to_give=0, date=2026-09-07.
3. Recalculate balances to create the Opening Balance ledger row (balance=-671657, showing in RED as To Take).
4. Verify all Dashboard totals match Khatabook (Rs 6,358,180 both sides).
"""
import os
import sys
import uuid
from datetime import date
from decimal import Decimal
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database.db import get_tenant_connection_string
from app.database.models import Portal, BankAccount, Retailer
from app.logic.ledger import recalculate_balances

TARGET_DB = "crediiflow_hello"
TARGET_DATE = date(2026, 9, 7)
CASH_PORTAL_AMOUNT = Decimal("671657.0")


def move_cash_portal():
    print(f"🔄 Moving CASH PORTAL from Portals to Retailers in {TARGET_DB}...")
    tenant_url = get_tenant_connection_string(TARGET_DB)
    engine = create_engine(tenant_url)
    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        # 1. Remove from Portals table
        portals = db.query(Portal).filter(func.lower(Portal.name) == "cash portal").all()
        for p in portals:
            db.delete(p)
            print(f"   🗑️ Deleted Portal '{p.name}' (id={p.id})")
        db.flush()

        # 2. Add or update in Retailers table
        ret = db.query(Retailer).filter(func.lower(Retailer.retailer_name) == "cash portal").first()
        if ret:
            ret.opening_to_take = CASH_PORTAL_AMOUNT
            ret.opening_to_give = Decimal("0")
            ret.opening_balance_set_on = TARGET_DATE
            ret.balance = Decimal("0")
            print(f"   ✅ Updated existing Retailer 'CASH PORTAL' (Take=₹{CASH_PORTAL_AMOUNT:,.0f})")
        else:
            ret = Retailer(
                retailer_name="CASH PORTAL",
                phone="9999900001",
                address="New Delhi",
                opening_to_take=CASH_PORTAL_AMOUNT,
                opening_to_give=Decimal("0"),
                balance=Decimal("0"),
                opening_balance_set_on=TARGET_DATE,
                is_active=True
            )
            db.add(ret)
            db.flush()
            print(f"   ➕ Created new Retailer 'CASH PORTAL' (Take=₹{CASH_PORTAL_AMOUNT:,.0f})")

        db.flush()

        # 3. Recalculate balances for CASH PORTAL
        recalculate_balances(ret.id, db)
        db.commit()
        print(f"   ✅ Recreated Opening Balance ledger entry for CASH PORTAL (Balance={ret.balance:,.0f})")

        # 4. Verification
        print("\n" + "=" * 65)
        print("VERIFICATION REPORT:")
        print("=" * 65)
        all_retailers = db.query(Retailer).all()
        all_portals = db.query(Portal).all()

        ret_give = sum(float(r.balance) for r in all_retailers if r.balance > 0)
        ret_take = sum(float(-r.balance) for r in all_retailers if r.balance < 0)

        p_take = sum(float(p.balance) for p in all_portals if p.balance > 0)
        p_give = sum(float(-p.balance) for p in all_portals if p.balance < 0)

        total_give = ret_give + p_give
        total_take = ret_take + p_take

        # Verify CASH PORTAL in retailer list
        cp_ret = db.query(Retailer).filter(func.lower(Retailer.retailer_name) == "cash portal").first()
        print(f"CASH PORTAL status: In Retailers? {'YES ✅' if cp_ret else 'NO ❌'}")
        if cp_ret:
            print(f"  -> Retailer Balance: {cp_ret.balance:,.0f} (Display: 🔴 RED ₹{-cp_ret.balance:,.0f} To Take)")
        
        cp_portal = db.query(Portal).filter(func.lower(Portal.name) == "cash portal").first()
        print(f"CASH PORTAL status: In Portals?   {'YES ⚠️' if cp_portal else 'NO ✅ (Removed as requested)'}")

        print(f"\nRetailer Balances: You will give: ₹{ret_give:,.0f} | You will get: ₹{ret_take:,.0f}")
        print(f"Portal Balances:   You will give: ₹{p_give:,.0f} | You will get: ₹{p_take:,.0f}")
        print(f"DASHBOARD TOTAL:   You will give: ₹{total_give:,.0f} | You will get: ₹{total_take:,.0f}")
        print(f"KHATABOOK TARGET:  You will give: ₹6,358,180 | You will get: ₹6,358,180")
        print(f"Date set:          {TARGET_DATE}")

        give_ok = abs(total_give - 6358180) < 1
        take_ok = abs(total_take - 6358180) < 1

        if give_ok and take_ok:
            print("\n🎉 PERFECT MATCH! Both Retailers and Portals are completely balanced!")
        else:
            print(f"\n⚠️ Difference detected: Give diff={total_give - 6358180}, Take diff={total_take - 6358180}")

    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()
        engine.dispose()


if __name__ == "__main__":
    move_cash_portal()
