"""
Clear ALL transaction entries from the do-it-services (crediiflow_hello) tenant.
Keeps: users, retailers, portals, bank_accounts, stores, business_settings
Deletes: collections, bank_deposits, ledgers, denominations, denomination_baselines,
         portal_adjustments, attendance
Resets: retailer.balance, portal.balance, bank_account.balance to opening balance values
        user.virtual_balance to 0
"""
import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from decimal import Decimal
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.database.db import get_tenant_connection_string
from app.database.models import (
    Retailer, Portal, BankAccount, User,
    Collection, BankDeposit, Ledger, Denomination, DenominationBaseline,
    PortalAdjustment, Attendance, BusinessSettings
)

TARGET_DB = "crediiflow_hello"


def clear_all_entries():
    print(f"🗑️  Clearing ALL entries from {TARGET_DB}...")
    
    tenant_url = get_tenant_connection_string(TARGET_DB)
    engine = create_engine(tenant_url)
    Session = sessionmaker(bind=engine)
    db = Session()
    
    try:
        # 1. Delete transaction tables (order matters for FK constraints)
        # Denominations reference collections and bank_deposits
        den_count = db.query(Denomination).delete()
        print(f"  Deleted {den_count} denominations")
        
        # Denomination baselines
        baseline_count = db.query(DenominationBaseline).delete()
        print(f"  Deleted {baseline_count} denomination baselines")
        
        # Ledgers reference collections and bank_deposits
        ledger_count = db.query(Ledger).delete()
        print(f"  Deleted {ledger_count} ledger entries")
        
        # Collections reference bank_deposits (mirror_deposit_id, online_routing_deposit_id)
        # First clear the FK references, then delete
        db.execute(text("UPDATE collections SET mirror_deposit_id = NULL, online_routing_deposit_id = NULL"))
        coll_count = db.query(Collection).delete()
        print(f"  Deleted {coll_count} collections")
        
        # Bank deposits
        dep_count = db.query(BankDeposit).delete()
        print(f"  Deleted {dep_count} bank deposits")
        
        # Portal adjustments
        adj_count = db.query(PortalAdjustment).delete()
        print(f"  Deleted {adj_count} portal adjustments")
        
        # Attendance
        att_count = db.query(Attendance).delete()
        print(f"  Deleted {att_count} attendance records")
        
        db.flush()
        
        # 2. Reset retailer balances to opening balance values
        retailers = db.query(Retailer).all()
        for r in retailers:
            net_opening = (r.opening_to_give or Decimal("0")) - (r.opening_to_take or Decimal("0"))
            r.balance = net_opening
        print(f"  Reset {len(retailers)} retailer balances to opening values")
        
        # 3. Reset portal balances to opening balance values
        portals = db.query(Portal).all()
        for p in portals:
            net_opening = (p.opening_to_give or Decimal("0")) - (p.opening_to_take or Decimal("0"))
            p.balance = net_opening
        print(f"  Reset {len(portals)} portal balances to opening values")
        
        # 4. Reset bank account balances to opening balance values
        bank_accounts = db.query(BankAccount).all()
        for ba in bank_accounts:
            net_opening = (ba.opening_to_give or Decimal("0")) - (ba.opening_to_take or Decimal("0"))
            ba.balance = net_opening
        print(f"  Reset {len(bank_accounts)} bank account balances to opening values")
        
        # 5. Reset staff virtual balances to 0
        users = db.query(User).all()
        for u in users:
            u.virtual_balance = Decimal("0")
        print(f"  Reset {len(users)} user virtual balances to 0")
        
        # 6. Reset opening_cash_in_hand in business settings
        biz = db.query(BusinessSettings).first()
        if biz:
            biz.opening_cash_in_hand = 0.0
            print("  Reset opening_cash_in_hand to 0")
        
        db.commit()
        
        # 7. Now recreate Opening Balance ledger entries via recalculate_balances
        from app.logic.ledger import recalculate_balances
        retailers = db.query(Retailer).all()
        for r in retailers:
            recalculate_balances(r.id, db)
        db.commit()
        print(f"  Recreated opening balance ledger entries for {len(retailers)} retailers")
        
        print(f"\n✅ All entries cleared from {TARGET_DB}! Only retailers, portals, staff, and stores remain.")
        
        # Print summary
        total_give = sum(float(r.balance) for r in db.query(Retailer).all() if r.balance > 0)
        total_take = sum(float(-r.balance) for r in db.query(Retailer).all() if r.balance < 0)
        print(f"   Retailer balances — You will give: ₹{total_give:,.0f} | You will get: ₹{total_take:,.0f}")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        raise
    finally:
        db.close()
        engine.dispose()


if __name__ == "__main__":
    clear_all_entries()
