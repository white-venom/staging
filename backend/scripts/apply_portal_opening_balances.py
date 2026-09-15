"""
Non-destructive migration to apply 14-Sep-2026 Portal opening balances:
1. Updates/creates Portals and their Primary BankAccount with opening_to_take and opening_to_give from Khatabook.
2. Preserves all existing live transactions (balance += opening delta).
3. Cleans up duplicate "Portal..." entries from Retailers table to avoid double-counting.
   - If a retailer has active transactions, only its opening balance is zeroed (transactions preserved).
   - If a retailer has no transactions, it is safely deleted.
4. Leaves CASH PORTAL as a Retailer (untouched).
"""
import os
import sys
from datetime import date
from decimal import Decimal
from sqlalchemy import create_engine, text, func
from sqlalchemy.orm import sessionmaker

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
if '/app' not in sys.path:
    sys.path.insert(0, '/app')

from app.database.db import get_tenant_connection_string, MasterSessionLocal
from app.database.master_models import Tenant
from app.database.models import (
    Portal, BankAccount, Retailer, Collection, BankDeposit, Ledger
)
from app.logic.ledger import recalculate_balances

KHATABOOK_PORTALS_14SEP = [
    {"name": "Portal Reli Pay", "take": 1164114.0, "give": 0.0},
    {"name": "PORTAL PAYNEARBY", "take": 85318.0, "give": 0.0},
    {"name": "Portal Parvej Telecom Rinova", "take": 53309.0, "give": 0.0},
    {"name": "Portal Rinova Pay", "take": 140532.0, "give": 0.0},
    {"name": "Portal Deal N Pay", "take": 400.0, "give": 0.0},
    {"name": "Portal Sekure Pay", "take": 81572.0, "give": 0.0},
    {"name": "Portal Soul Pay", "take": 486616.0, "give": 0.0},
    {"name": "Portal Airtel Payment Bank", "take": 0.0, "give": 0.0},
    {"name": "Dheeraj Tomar Reli Pay Portal", "take": 418.0, "give": 0.0},
    {"name": "Nitish Bhati Reli Pay Portal", "take": 429.0, "give": 0.0},
    {"name": "Od Reli pay", "take": 0.0, "give": 0.0},
    {"name": "Portal Paygrt", "take": 2494.0, "give": 0.0},
    {"name": "Jaharveer Portal", "take": 0.0, "give": 0.0},
    {"name": "Portal K1 Pay", "take": 0.0, "give": 0.0},
    {"name": "Od PAYNEARBY", "take": 0.0, "give": 300000.0},
    {"name": "Portal Imps Guru", "take": 50.0, "give": 0.0},
    {"name": "Portal Pay 1", "take": 469.0, "give": 0.0},
    {"name": "Super Sekure Pay Portal", "take": 1000.0, "give": 0.0},
    {"name": "Portal Appar Service", "take": 5500.0, "give": 0.0},
    {"name": "Portal Go Payment", "take": 100.0, "give": 0.0},
    {"name": "Od Rinova", "take": 0.0, "give": 500000.0},
    {"name": "Portal Vidcom", "take": 0.0, "give": 0.0},
    {"name": "Vikas Rinova Portal Hasan Pur", "take": 0.0, "give": 0.0},
    {"name": "PORTAL SUPER RINOVA PAY", "take": 0.0, "give": 0.0},
    {"name": "PORTAL SUPER PAYNEARBY", "take": 0.0, "give": 0.0},
    {"name": "Portal Super Soul Pay", "take": 0.0, "give": 0.0},
]


def apply_portals_to_db(db_name: str):
    print("=" * 65)
    print(f"🚀 Applying 14-Sep Portal Opening Balances to: {db_name}")
    print("=" * 65)

    tenant_url = get_tenant_connection_string(db_name)
    engine = create_engine(tenant_url)
    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        existing_portals = db.query(Portal).all()
        portal_by_lower = {p.name.strip().lower(): p for p in existing_portals}

        # 1. Update or Create Portals
        print("\n1. Updating Portals with 14-Sep Opening Balances...")
        for pdata in KHATABOOK_PORTALS_14SEP:
            name = pdata["name"].strip()
            key = name.lower()
            take = Decimal(str(pdata["take"]))
            give = Decimal(str(pdata["give"]))
            new_opening_net = take - give

            # Match portal by lower name or normalized prefixes
            portal = portal_by_lower.get(key)
            if not portal and key.startswith("portal "):
                portal = portal_by_lower.get(key[7:])
            if not portal and key.startswith("od "):
                portal = portal_by_lower.get(key[3:])

            if portal:
                old_take = portal.opening_to_take or Decimal("0.00")
                old_give = portal.opening_to_give or Decimal("0.00")
                old_opening_net = old_take - old_give
                opening_delta = new_opening_net - old_opening_net

                portal.opening_to_take = take
                portal.opening_to_give = give
                # Non-destructive: preserve today's transactions by adding delta
                portal.balance = (portal.balance or Decimal("0.00")) + opening_delta

                accounts = db.query(BankAccount).filter(BankAccount.portal_id == portal.id).all()
                if accounts:
                    for a in accounts:
                        a.opening_to_take = take
                        a.opening_to_give = give
                        a.balance = (a.balance or Decimal("0.00")) + opening_delta
                else:
                    acc = BankAccount(
                        portal_id=portal.id,
                        bank_account_name="Primary Account",
                        opening_to_take=take,
                        opening_to_give=give,
                        balance=portal.balance,
                        show_in_online_payment=True
                    )
                    db.add(acc)
                print(f"   ✅ Updated Portal '{portal.name}': Take=₹{take:,.0f} | Give=₹{give:,.0f} | Bal=₹{portal.balance:,.0f}")
            else:
                new_portal = Portal(
                    name=name,
                    opening_to_take=take,
                    opening_to_give=give,
                    balance=new_opening_net
                )
                db.add(new_portal)
                db.flush()
                acc = BankAccount(
                    portal_id=new_portal.id,
                    bank_account_name="Primary Account",
                    opening_to_take=take,
                    opening_to_give=give,
                    balance=new_opening_net,
                    show_in_online_payment=True
                )
                db.add(acc)
                portal_by_lower[key] = new_portal
                print(f"   ➕ Created Portal '{name}': Take=₹{take:,.0f} | Give=₹{give:,.0f} | Bal=₹{new_opening_net:,.0f}")

        db.flush()

        # 2. Clean up duplicate "Portal..." entries in Retailers table
        print("\n2. Checking Retailers table for duplicate Portal entries...")
        portal_names_set = {p["name"].strip().lower() for p in KHATABOOK_PORTALS_14SEP}
        all_retailers = db.query(Retailer).all()

        deleted_retailers = 0
        zeroed_retailers = 0

        for r in all_retailers:
            r_name = r.retailer_name.strip().lower()
            if r_name in portal_names_set:
                # Check if this retailer row has real transactions
                has_collections = db.query(Collection).filter(Collection.retailer_id == r.id).first() is not None
                has_deposits = db.query(BankDeposit).filter(BankDeposit.retailer_id == r.id).first() is not None
                has_real_ledger = db.query(Ledger).filter(
                    Ledger.retailer_id == r.id,
                    Ledger.description != "Opening Balance"
                ).first() is not None

                if has_collections or has_deposits or has_real_ledger:
                    # Has active transactions: DO NOT DELETE! Zero the duplicate opening balance only
                    print(f"   ⚠️ Retailer '{r.retailer_name}' has active transactions. Zeroing opening balance to avoid double-counting.")
                    r.opening_to_take = Decimal("0.00")
                    r.opening_to_give = Decimal("0.00")
                    recalculate_balances(r.id, db)
                    zeroed_retailers += 1
                else:
                    # No transactions: Safe to delete
                    print(f"   🗑️ Removing duplicate Retailer '{r.retailer_name}' (no transactions).")
                    db.query(Ledger).filter(Ledger.retailer_id == r.id).delete()
                    db.delete(r)
                    deleted_retailers += 1

        db.commit()
        print(f"   Retailer cleanup complete: {deleted_retailers} deleted, {zeroed_retailers} zeroed.")

        # 3. Verification Report
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

        print(f"Retailer Balances: To Give: ₹{ret_give:,.2f} | To Take: ₹{ret_take:,.2f}")
        print(f"Portal Balances:   To Give: ₹{p_give:,.2f} | To Take: ₹{p_take:,.2f}")
        print(f"TOTAL DASHBOARD:   To Give: ₹{total_give:,.2f} | To Take: ₹{total_take:,.2f}")

    except Exception as e:
        db.rollback()
        print(f"❌ Error applying portal opening balances on {db_name}: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()
        engine.dispose()


def main():
    target_dbs = []
    if len(sys.argv) > 1:
        target_dbs = [sys.argv[1]]
    else:
        try:
            master_db = MasterSessionLocal()
            tenants = master_db.query(Tenant).filter(Tenant.status == 'active').all()
            for t in tenants:
                if t.subdomain in ('do-it-services', 'hello', 'do-it') or 'doit' in t.db_name or 'hello' in t.db_name:
                    if t.db_name not in target_dbs:
                        target_dbs.append(t.db_name)
            master_db.close()
        except Exception as e:
            print(f"Could not query master db: {e}")

    if not target_dbs:
        target_dbs = ['crediiflow_do_it_services', 'doit_production', 'crediiflow_hello']

    print(f"Target tenant databases: {target_dbs}")
    for db_name in target_dbs:
        try:
            apply_portals_to_db(db_name)
        except Exception as e:
            print(f"Failed on {db_name}: {e}")


if __name__ == '__main__':
    main()
