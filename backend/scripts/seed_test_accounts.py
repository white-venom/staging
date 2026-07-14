import uuid
from sqlalchemy import select
from app.database.db import SessionLocal
from app.database.models import User, Retailer
from app.core.security import get_password_hash

def seed():
    db = SessionLocal()
    try:
        # Check if staff exists
        staff_phone = "9917128864"
        staff = db.scalar(select(User).where(User.phone == staff_phone))
        if not staff:
            print(f"Creating staff user: {staff_phone}")
            staff = User(
                id=uuid.uuid4(),
                name="Sujeet Staff",
                phone=staff_phone,
                password_hash=get_password_hash("pass123"),
                role="staff"
            )
            db.add(staff)
        else:
            print(f"Resetting password for existing staff user: {staff_phone}")
            staff.password_hash = get_password_hash("pass123")
        
        # Check if admin exists
        admin_phone = "7900671145"
        admin = db.scalar(select(User).where(User.phone == admin_phone))
        if not admin:
            print(f"Creating admin user: {admin_phone}")
            admin = User(
                id=uuid.uuid4(),
                name="Sujeet Admin",
                phone=admin_phone,
                password_hash=get_password_hash("pass123"),
                role="admin"
            )
            db.add(admin)
        else:
            print(f"Resetting password for existing admin user: {admin_phone}")
            admin.password_hash = get_password_hash("pass123")

        # Seed some retailers
        retailers = [
            {"name": "Aggarwal Kirana Store", "phone": "9876543210", "address": "Sector 15, Rohini"},
            {"name": "Karan Provision & General", "phone": "9812345678", "address": "Dwarka Sector 7"},
            {"name": "Sharma Supermarket", "phone": "9555667788", "address": "Pitampura"}
        ]
        
        for r in retailers:
            exists = db.scalar(select(Retailer).where(Retailer.phone == r["phone"]))
            if not exists:
                print(f"Creating retailer: {r['name']}")
                new_r = Retailer(
                    id=uuid.uuid4(),
                    retailer_name=r["name"],
                    phone=r["phone"],
                    address=r["address"],
                    balance=0.0
                )
                db.add(new_r)
            
        db.commit()
        print("Seed completed successfully.")
    except Exception as e:
        print(f"Error seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()
