"""
Sync Khatabook Portal entries into the `portals` table in crediiflow_hello:
1. Identify Portal entries from Khatabook.
2. Create / update them in `portals` table (with Primary Account in `bank_accounts`).
3. Set their opening_to_take, opening_to_give, and balance correctly.
4. Reset any other existing portals to 0.
5. Remove portal entries from `retailers` table (so they aren't double-counted).
6. Recalculate retailer balances so Retailer + Portal = Khatabook total exactly (Rs 6,358,180).
7. Ensure all dates are set to 7 Sept 2026.
"""
import os
import sys
import uuid
from datetime import date
from decimal import Decimal
from sqlalchemy import create_engine, select, func, text
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

# The Khatabook entries that represent Portals:
# Entries starting with "Portal", ending with "Portal", "CASH PORTAL", or "Od ..."
def is_portal_entry(name: str) -> bool:
    nl = name.strip().lower()
    # Explicit exclusions (these are individual retailers, not portals):
    if "retailer" in nl:
        return False
    if nl.startswith("portal ") or nl.endswith(" portal") or nl == "cash portal" or nl.startswith("od "):
        return True
    return False


def run_portal_sync():
    print(f"🚀 Syncing Khatabook Portals into {TARGET_DB}...")
    tenant_url = get_tenant_connection_string(TARGET_DB)
    engine = create_engine(tenant_url)
    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        # Separate Khatabook seed entries into Portals and Retailers
        portal_seeds = []
        retailer_seeds = []
        for s in RETAILERS_TO_SEED:
            if is_portal_entry(s['name']):
                portal_seeds.append(s)
            else:
                retailer_seeds.append(s)

        print(f"Total Khatabook entries: {len(RETAILERS_TO_SEED)}")
        print(f"  -> Portals:   {len(portal_seeds)}")
        print(f"  -> Retailers: {len(retailer_seeds)}")

        # 1. Clear any transactions/adjustments to ensure clean state
        db.execute(text("UPDATE collections SET mirror_deposit_id = NULL, online_routing_deposit_id = NULL"))
        db.query(Denomination).delete()
        db.query(DenominationBaseline).delete()
        db.query(Ledger).delete()
        db.query(Collection).delete()
        db.query(BankDeposit).delete()
        db.query(PortalAdjustment).delete()
        db.query(Attendance).delete()
        print("\n1. ✅ Cleared transaction tables.")

        # 2. Sync Portals
        print("\n2. Syncing Portals table...")
        existing_portals = db.query(Portal).all()
        portal_map_by_lower = {p.name.strip().lower(): p for p in existing_portals}

        synced_portal_ids = set()

        for ps in portal_seeds:
            p_name = ps['name'].strip()
            p_key = p_name.lower()
            p_take = Decimal(str(ps['take']))
            p_give = Decimal(str(ps['give']))
            # In CrediiFlow: Portal balance = Assets - Liabilities (to_take - to_give)
            p_bal = p_take - p_give

            # Check if portal already exists (exact or normalized)
            target_portal = portal_map_by_lower.get(p_key)
            # Try without "portal " prefix
            if not target_portal and p_key.startswith("portal "):
                target_portal = portal_map_by_lower.get(p_key[7:])
            if not target_portal and p_key.startswith("od "):
                target_portal = portal_map_by_lower.get(p_key[3:])

            if target_portal:
                target_portal.opening_to_take = p_take
                target_portal.opening_to_give = p_give
                target_portal.balance = p_bal
                synced_portal_ids.add(target_portal.id)
                print(f"   Updated Portal: '{target_portal.name}' (Take={p_take:,.0f}, Give={p_give:,.0f}, Bal={p_bal:,.0f})")
                
                # Update its bank accounts
                accounts = db.query(BankAccount).filter(BankAccount.portal_id == target_portal.id).all()
                if not accounts:
                    primary_acc = BankAccount(
                        portal_id=target_portal.id,
                        bank_account_name="Primary Account",
                        opening_to_take=p_take,
                        opening_to_give=p_give,
                        balance=p_bal
                    )
                    db.add(primary_acc)
                else:
                    for a in accounts:
                        a.opening_to_take = p_take
                        a.opening_to_give = p_give
                        a.balance = p_bal
            else:
                # Create brand new Portal
                new_portal = Portal(
                    name=p_name,
                    opening_to_take=p_take,
                    opening_to_give=p_give,
                    balance=p_bal
                )
                db.add(new_portal)
                db.flush()
                synced_portal_ids.add(new_portal.id)
                portal_map_by_lower[p_key] = new_portal

                # Create primary bank account
                primary_acc = BankAccount(
                    portal_id=new_portal.id,
                    bank_account_name="Primary Account",
                    opening_to_take=p_take,
                    opening_to_give=p_give,
                    balance=p_bal
                )
                db.add(primary_acc)
                print(f"   Created Portal: '{p_name}' (Take={p_take:,.0f}, Give={p_give:,.0f}, Bal={p_bal:,.0f})")

        # Set any unsynced existing portals to 0
        for p in existing_portals:
            if p.id not in synced_portal_ids:
                p.opening_to_take = Decimal("0")
                p.opening_to_give = Decimal("0")
                p.balance = Decimal("0")
                for a in db.query(BankAccount).filter(BankAccount.portal_id == p.id).all():
                    a.opening_to_take = Decimal("0")
                    a.opening_to_give = Decimal("0")
                    a.balance = Decimal("0")
                print(f"   Zeroed unused Portal: '{p.name}'")

        db.flush()

        # 3. Clean up Retailers: remove the portal entries from retailers table
        print("\n3. Cleaning up Retailers table...")
        portal_names_lower = {ps['name'].strip().lower() for ps in portal_seeds}
        existing_retailers = db.query(Retailer).all()
        
        deleted_retailers = 0
        for r in existing_retailers:
            if r.retailer_name.strip().lower() in portal_names_lower:
                db.delete(r)
                deleted_retailers += 1

        db.flush()
        print(f"   Deleted {deleted_retailers} portal entries from Retailers table.")

        # 4. Sync Remaining Retailers from Khatabook
        print("\n4. Syncing remaining Retailers...")
        all_retailers = db.query(Retailer).all()
        ret_by_name = {r.retailer_name.strip().lower(): r for r in all_retailers}
        used_phones = {r.phone.strip() for r in all_retailers if r.phone}

        name_mapping = {
            "gagan cyber care rinkesh": "gagan cyber cafe",
            "guru ji garakh sewa kendra mohit": "guruji grahak sewa kendra mohit",
            "cdm stuck details": "cdm stuck",
        }

        updated_ret = 0
        created_ret = 0

        for seed in retailer_seeds:
            seed_name = seed['name'].strip()
            seed_key = seed_name.lower()
            seed_take = Decimal(str(seed['take']))
            seed_give = Decimal(str(seed['give']))

            target = ret_by_name.get(seed_key)
            if not target and seed_key in name_mapping:
                target = ret_by_name.get(name_mapping[seed_key])

            if target:
                target.opening_to_take = seed_take
                target.opening_to_give = seed_give
                target.opening_balance_set_on = TARGET_DATE
                target.balance = Decimal("0")
                updated_ret += 1
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
                ret_by_name[seed_key] = new_r
                created_ret += 1

        # Ensure all existing retailers have date 7 Sept 2026
        for r in db.query(Retailer).all():
            r.opening_balance_set_on = TARGET_DATE

        db.flush()
        print(f"   Retailers updated: {updated_ret}, created: {created_ret}")

        # 5. Recalculate retailer balances
        print("\n5. Recalculating ledger balances for all retailers...")
        remaining_retailers = db.query(Retailer).all()
        for r in remaining_retailers:
            recalculate_balances(r.id, db)
        db.commit()
        print(f"   ✅ Opening balance ledger entries created for {len(remaining_retailers)} retailers.")

        # 6. Verification
        print(f"\n{'='*60}")
        print("VERIFICATION REPORT:")
        print(f"{'='*60}")
        all_retailers = db.query(Retailer).all()
        all_portals = db.query(Portal).all()

        ret_give = sum(float(r.balance) for r in all_retailers if r.balance > 0)
        ret_take = sum(float(-r.balance) for r in all_retailers if r.balance < 0)

        # In frontend dashboard:
        # portalToTake = (portalDirectory || []).reduce((s, p) => s + (p.balance > 0 ? p.balance : 0), 0);
        # portalToGive = (portalDirectory || []).reduce((s, p) => s + (p.balance < 0 ? -p.balance : 0), 0);
        p_take = sum(float(p.balance) for p in all_portals if p.balance > 0)
        p_give = sum(float(-p.balance) for p in all_portals if p.balance < 0)

        total_give = ret_give + p_give
        total_take = ret_take + p_take

        seed_take = sum(r['take'] for r in RETAILERS_TO_SEED)
        seed_give = sum(r['give'] for r in RETAILERS_TO_SEED)

        print(f"Retailers ({len(all_retailers)}): You will give: ₹{ret_give:,.0f} | You will get: ₹{ret_take:,.0f}")
        print(f"Portals   ({len(all_portals)}): You will give: ₹{p_give:,.0f} | You will get: ₹{p_take:,.0f}")
        print(f"DASHBOARD TOTALS:      You will give: ₹{total_give:,.0f} | You will get: ₹{total_take:,.0f}")
        print(f"KHATABOOK TARGET:      You will give: ₹{seed_give:,.0f} | You will get: ₹{seed_take:,.0f}")
        print(f"Diff Give: {total_give - seed_give:,.0f} | Diff Take: {total_take - seed_take:,.0f}")
        print(f"Date set on all:       {TARGET_DATE}")

        if abs(total_give - seed_give) < 1 and abs(total_take - seed_take) < 1:
            print("\n🎉 PERFECT MATCH! Both Portals page and Retailers page are properly set!")
        else:
            print("\n⚠️ Note: Check any difference above.")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Error during sync: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()
        engine.dispose()


if __name__ == "__main__":
    run_portal_sync()
