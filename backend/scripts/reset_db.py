import sys
import os
import uuid
from datetime import datetime, date
from decimal import Decimal

# Add parent directory to path to import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.database.db import SessionLocal, engine, Base
from app.database.models import User, PortalGroup, Portal, Retailer, Store, BusinessSettings
from app.core.security import get_password_hash

def reset_database():
    print("Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("Creating all tables...")
    Base.metadata.create_all(bind=engine)

def seed_data():
    db: Session = SessionLocal()
    try:
        # 1. Create Admin
        admin = User(
            id=uuid.uuid4(),
            name="Admin User",
            phone="9999999999",
            role="admin",
            password_hash=get_password_hash("admin123")
        )
        db.add(admin)

        # 2. Create 2 Staff
        staff1 = User(
            id=uuid.uuid4(),
            name="Staff One",
            phone="8888888888",
            role="staff",
            password_hash=get_password_hash("staff123")
        )
        staff2 = User(
            id=uuid.uuid4(),
            name="Staff Two",
            phone="7777777777",
            role="staff",
            password_hash=get_password_hash("staff123")
        )
        db.add_all([staff1, staff2])
        db.commit()

        # 3. Create 12 Portal Groups
        portal_groups_data = [
            "PayNearby", "Spice Money", "Fino Bank", "Airtel Payment Bank", 
            "RNFI", "Relipay", "PayTM", "Eko", "Rapipay", "Dogma", "Vakrangee", "iServeU"
        ]
        
        for group_name in portal_groups_data:
            pg = PortalGroup(
                id=uuid.uuid4(),
                name=group_name,
                opening_to_give=0.0,
                opening_to_take=0.0,
                balance=0.0
            )
            db.add(pg)
            db.flush() # Get ID

            # Create 5 Bank Accounts (Portals) for each group
            banks = ["SBI", "ICICI", "HDFC", "AXIS", "BOI"]
            for i, bank in enumerate(banks):
                portal = Portal(
                    id=uuid.uuid4(),
                    group_id=pg.id,
                    portal_name=f"{group_name} {bank}",
                    bank_name=bank,
                    bank_account_no=f"1234567890{i}",
                    ifsc_code=f"{bank[:4]}0123456"
                )
                db.add(portal)

        # 4. Create 2 Test Retailers with 3 stores each
        retailers = [
            {"name": "Retailer Alpha", "phone": "1111111111", "address": "Market Street A", "staff": staff1},
            {"name": "Retailer Beta", "phone": "2222222222", "address": "Market Street B", "staff": staff2}
        ]

        for ret_data in retailers:
            retailer = Retailer(
                id=uuid.uuid4(),
                retailer_name=ret_data["name"],
                phone=ret_data["phone"],
                address=ret_data["address"],
                assigned_staff_id=ret_data["staff"].id,
                email=f"{ret_data['name'].lower().replace(' ', '')}@example.com"
            )
            db.add(retailer)
            db.flush()

            # Create 3 stores for each retailer
            for i in range(1, 4):
                store = Store(
                    id=uuid.uuid4(),
                    retailer_id=retailer.id,
                    store_name=f"{retailer.retailer_name} Store {i}",
                    address=f"{retailer.address}, Store {i}",
                    phone=f"{retailer.phone[:-1]}{i}"
                )
                db.add(store)

        # 5. Create Business Settings
        settings = BusinessSettings(
            id=1,
            late_threshold="10:00",
            late_penalty=100.0
        )
        db.add(settings)
        db.flush()

        # 6. Create some Test Collections and Deposits
        from app.database.models import Collection, BankDeposit, Ledger, Denomination
        import random
        from datetime import timedelta

        # Get some IDs we just created
        all_retailers = db.query(Retailer).all()
        all_portals = db.query(Portal).all()
        
        for i in range(10):
            # Collections
            ret = random.choice(all_retailers)
            por = random.choice(all_portals)
            amt = random.randint(500, 5000)
            
            coll = Collection(
                id=uuid.uuid4(),
                retailer_id=ret.id,
                store_id=ret.stores[0].id if ret.stores else uuid.uuid4(), # fallback if no store
                staff_id=ret.assigned_staff_id,
                total_amount=amt,
                collection_date=datetime.utcnow().date(),
                status="verified",
                remarks=f"Test Collection {i+1}",
                created_at=datetime.utcnow() - timedelta(days=random.randint(0, 5), hours=random.randint(1, 10))
            )
            db.add(coll)
            db.flush()

            # Add Denomination
            denom = Denomination(
                id=uuid.uuid4(),
                collection_id=coll.id,
                online_amount=amt
            )
            db.add(denom)
            
            # Update Retailer Balance via Ledger
            ledger = Ledger(
                id=uuid.uuid4(),
                retailer_id=ret.id,
                collection_id=coll.id,
                transaction_type="credit",
                amount=amt,
                balance=amt, # Simplified
                description=f"Collection: {por.portal_name}"
            )
            db.add(ledger)

            # Deposits
            dep_amt = random.randint(300, 3000)
            dep = BankDeposit(
                id=uuid.uuid4(),
                portal_id=por.id,
                staff_id=ret.assigned_staff_id,
                amount=dep_amt,
                payment_mode="cash",
                deposit_type="portal",
                status="verified",
                deposit_date=date.today(),
                created_at=datetime.utcnow() - timedelta(days=random.randint(0, 5), hours=random.randint(1, 10))
            )
            db.add(dep)

        db.commit()
        print("Database seeded with test transactions successfully!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    reset_database()
    seed_data()
