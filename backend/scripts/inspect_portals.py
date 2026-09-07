import sys, os
sys.path.insert(0, '/app')

from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database.db import get_tenant_connection_string
from app.database.models import Portal, BankAccount, Retailer

TARGET_DB = "crediiflow_hello"

def inspect():
    engine = create_engine(get_tenant_connection_string(TARGET_DB))
    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        portals = db.query(Portal).all()
        print(f"=== PORTALS IN {TARGET_DB} ({len(portals)}) ===")
        total_p_give = Decimal("0")
        total_p_take = Decimal("0")
        
        for p in portals:
            bal = p.balance or Decimal("0")
            give = bal if bal < 0 else Decimal("0") # wait, portal bal: if bal < 0 => to_give = -bal? Or bal > 0 => to_take?
            # In page.tsx:
            # portalToTake = (portalDirectory || []).reduce((s, p) => s + (p.balance > 0 ? p.balance : 0), 0);
            # portalToGive = (portalDirectory || []).reduce((s, p) => s + (p.balance < 0 ? -p.balance : 0), 0);
            p_to_take = bal if bal > 0 else Decimal("0")
            p_to_give = -bal if bal < 0 else Decimal("0")
            total_p_take += p_to_take
            total_p_give += p_to_give

            print(f"Portal '{p.name}' (id={p.id}):")
            print(f"   opening_to_give={p.opening_to_give}, opening_to_take={p.opening_to_take}, balance={p.balance}")
            print(f"   -> Dashboard: to_take={p_to_take}, to_give={p_to_give}")

            accounts = db.query(BankAccount).filter(BankAccount.portal_id == p.id).all()
            for a in accounts:
                print(f"      Acc '{a.bank_account_name}' ({a.bank_name}): opening_give={a.opening_to_give}, opening_take={a.opening_to_take}, balance={a.balance}")

        print(f"\nTOTAL PORTAL DASHBOARD:")
        print(f"   Portal To Give: {total_p_give}")
        print(f"   Portal To Take: {total_p_take}")

    finally:
        db.close()
        engine.dispose()

if __name__ == "__main__":
    inspect()
