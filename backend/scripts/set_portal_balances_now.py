"""
Directly set Portal opening balances and balances from Khatabook into crediiflow_hello.
"""
import os
import sys
from datetime import date
from decimal import Decimal
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database.db import get_tenant_connection_string
from app.database.models import Portal, BankAccount, Retailer, Ledger
from app.logic.ledger import recalculate_balances

TARGET_DB = "crediiflow_hello"
TARGET_DATE = date(2026, 9, 7)

KHATABOOK_PORTALS = [
    {"name": "CASH PORTAL", "take": 671657.0, "give": 0.0},
    {"name": "Portal Reli Pay", "take": 166070.0, "give": 0.0},
    {"name": "Portal Rinova Pay", "take": 130714.0, "give": 0.0},
    {"name": "PORTAL PAYNEARBY", "take": 84338.0, "give": 0.0},
    {"name": "Portal Parvej Telecom Rinova", "take": 57510.0, "give": 0.0},
    {"name": "Portal Sekure Pay", "take": 35572.0, "give": 0.0},
    {"name": "Portal Soul Pay", "take": 25616.0, "give": 0.0},
    {"name": "Portal Appar Service", "take": 5500.0, "give": 0.0},
    {"name": "Portal Deal N Pay", "take": 4400.0, "give": 0.0},
    {"name": "Portal Paygrt", "take": 2494.0, "give": 0.0},
    {"name": "Super Sekure Pay Portal", "take": 1000.0, "give": 0.0},
    {"name": "Portal Pay 1", "take": 469.0, "give": 0.0},
    {"name": "Portal Go Payment", "take": 100.0, "give": 0.0},
    {"name": "Portal Imps Guru", "take": 50.0, "give": 0.0},
    {"name": "Portal Airtel Payment Bank", "take": 0.0, "give": 0.0},
    {"name": "Portal K1 Pay", "take": 0.0, "give": 0.0},
    {"name": "Portal Vidcom", "take": 0.0, "give": 0.0},
    {"name": "Jaharveer Portal", "take": 0.0, "give": 0.0},
    {"name": "PORTAL SUPER RINOVA PAY", "take": 0.0, "give": 0.0},
    {"name": "PORTAL SUPER PAYNEARBY", "take": 0.0, "give": 0.0},
    {"name": "Portal Super Soul Pay", "take": 0.0, "give": 0.0},
    {"name": "Od Rinova", "take": 0.0, "give": 500000.0},
    {"name": "Od PAYNEARBY", "take": 0.0, "give": 300000.0},
    {"name": "Od Reli pay", "take": 0.0, "give": 0.0},
    {"name": "Vikas Rinova Portal Hasan Pur", "take": 0.0, "give": 0.0},
]


def apply_portal_balances():
    print(f"🔧 Directly setting portal balances in {TARGET_DB}...")
    tenant_url = get_tenant_connection_string(TARGET_DB)
    engine = create_engine(tenant_url)
    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        existing_portals = db.query(Portal).all()
        portal_by_lower = {p.name.strip().lower(): p for p in existing_portals}

        # Match and update each portal
        for pdata in KHATABOOK_PORTALS:
            name = pdata["name"].strip()
            key = name.lower()
            take = Decimal(str(pdata["take"]))
            give = Decimal(str(pdata["give"]))
            bal = take - give

            portal = portal_by_lower.get(key)
            if not portal and key.startswith("portal "):
                portal = portal_by_lower.get(key[7:])
            if not portal and key.startswith("od "):
                portal = portal_by_lower.get(key[3:])

            if portal:
                portal.opening_to_take = take
                portal.opening_to_give = give
                portal.balance = bal

                accounts = db.query(BankAccount).filter(BankAccount.portal_id == portal.id).all()
                if accounts:
                    for a in accounts:
                        a.opening_to_take = take
                        a.opening_to_give = give
                        a.balance = bal
                else:
                    acc = BankAccount(
                        portal_id=portal.id,
                        bank_account_name="Primary Account",
                        opening_to_take=take,
                        opening_to_give=give,
                        balance=bal
                    )
                    db.add(acc)
                print(f"✅ Set Portal '{portal.name}': Take=₹{take:,.0f} | Give=₹{give:,.0f} | Bal=₹{bal:,.0f}")
            else:
                new_portal = Portal(
                    name=name,
                    opening_to_take=take,
                    opening_to_give=give,
                    balance=bal
                )
                db.add(new_portal)
                db.flush()
                acc = BankAccount(
                    portal_id=new_portal.id,
                    bank_account_name="Primary Account",
                    opening_to_take=take,
                    opening_to_give=give,
                    balance=bal
                )
                db.add(acc)
                portal_by_lower[key] = new_portal
                print(f"➕ Created Portal '{name}': Take=₹{take:,.0f} | Give=₹{give:,.0f} | Bal=₹{bal:,.0f}")

        # Also remove any portal entries from Retailer table so they don't double count
        portal_names = {p["name"].strip().lower() for p in KHATABOOK_PORTALS}
        rets_to_del = db.query(Retailer).filter(func.lower(Retailer.retailer_name).in_(portal_names)).all()
        for r in rets_to_del:
            db.delete(r)
        print(f"🗑️ Removed {len(rets_to_del)} portal entries from Retailers table.")

        db.commit()

        # Recalculate remaining retailers
        print("🔄 Recalculating remaining retailer balances...")
        remaining = db.query(Retailer).all()
        for r in remaining:
            recalculate_balances(r.id, db)
        db.commit()

        # Final Verification Table
        print("\n" + "=" * 70)
        print("PORTALS CURRENT STATE IN DATABASE:")
        print("=" * 70)
        all_portals = db.query(Portal).order_by(Portal.name).all()
        total_p_take = Decimal("0")
        total_p_give = Decimal("0")
        for p in all_portals:
            t = p.opening_to_take or Decimal("0")
            g = p.opening_to_give or Decimal("0")
            b = p.balance or Decimal("0")
            total_p_take += t
            total_p_give += g
            print(f"  {p.name:<35} | Take: ₹{t:>10,.0f} | Give: ₹{g:>10,.0f} | Bal: ₹{b:>10,.0f}")

        all_rets = db.query(Retailer).all()
        ret_give = sum(float(r.balance) for r in all_rets if r.balance > 0)
        ret_take = sum(float(-r.balance) for r in all_rets if r.balance < 0)

        # Dashboard totals
        dash_give = ret_give + float(total_p_give)
        dash_take = ret_take + float(total_p_take)

        print("\n" + "=" * 70)
        print("DASHBOARD RECONCILIATION:")
        print("=" * 70)
        print(f"Retailer Balances: You will give: ₹{ret_give:,.0f} | You will get: ₹{ret_take:,.0f}")
        print(f"Portal Balances:   You will give: ₹{total_p_give:,.0f} | You will get: ₹{total_p_take:,.0f}")
        print(f"Grand Total:       You will give: ₹{dash_give:,.0f} | You will get: ₹{dash_take:,.0f}")
        print(f"Khatabook Goal:    You will give: ₹6,358,180 | You will get: ₹6,358,180")
        print(f"Match:             Give: {'✅' if abs(dash_give - 6358180) < 1 else '❌'} | Take: {'✅' if abs(dash_take - 6358180) < 1 else '❌'}")

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
    from sqlalchemy import func
    apply_portal_balances()
