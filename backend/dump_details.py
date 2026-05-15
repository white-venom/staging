import sys
import os
from sqlalchemy import select
from sqlalchemy.orm import Session

# Set up module path resolution
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database.db import SessionLocal
from app.database.models import User, Retailer, Portal

def dump_system_details():
    db = SessionLocal()
    try:
        print("\n" + "="*50)
        print("🚀 SYSTEM CREDENTIALS & ENTITY DETAILS")
        print("="*50)

        # 1. USERS (Admin & Staff)
        print("\n👥 USERS (Login with Phone & password123)")
        users = db.scalars(select(User)).all()
        for u in users:
            print(f"   - Name: {u.name}")
            print(f"     Phone: {u.phone}")
            print(f"     Role: {u.role}")
            print(f"     Password: password123")
            print("-" * 20)

        # 2. RETAILERS
        print("\n🏪 REGISTERED RETAILERS")
        retailers = db.scalars(select(Retailer)).all()
        for r in retailers:
            print(f"   - Name: {r.retailer_name}")
            print(f"     Phone: {r.phone}")
            print(f"     Address: {r.address}")
            print(f"     Ledger Token: {r.ledger_token}")
            print("-" * 20)

        # 3. PORTALS
        print("\n🌐 PORTAL / STORE CHANNELS")
        portals = db.scalars(select(Portal)).all()
        if not portals:
            print("   (No portals seeded yet. Using defaults like 'Blinkit Store Sector 5')")
        for p in portals:
            print(f"   - Name: {p.portal_name}")
            print("-" * 20)

        print("\n" + "="*50)
    finally:
        db.close()

if __name__ == "__main__":
    dump_system_details()
