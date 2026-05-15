from app.database.db import SessionLocal
from app.database.models import Retailer, PortalGroup
from sqlalchemy import select

def check_balances():
    db = SessionLocal()
    print("\n--- RETAILERS ---")
    retailers = db.scalars(select(Retailer)).all()
    for r in retailers:
        print(f"Name: {r.retailer_name}, Opening Take: {r.opening_to_take}, Opening Give: {r.opening_to_give}, Net Balance (from DB): {r.balance}")
    
    print("\n--- PORTAL GROUPS ---")
    groups = db.scalars(select(PortalGroup)).all()
    for g in groups:
        print(f"Name: {g.name}, Opening Take: {g.opening_to_take}, Opening Give: {g.opening_to_give}, Current Balance (from DB): {g.balance}")
    db.close()

if __name__ == "__main__":
    check_balances()
