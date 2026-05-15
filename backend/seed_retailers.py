import sys
import os
import uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Set up module path resolution
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database.models import Retailer, User
from app.database.db import SessionLocal

def seed_retailers():
    db = SessionLocal()
    try:
        # Get a staff user to assign retailers to
        staff = db.query(User).filter(User.role == "staff").first()
        staff_id = staff.id if staff else None

        retailers_data = [
            {"name": "Aggarwal Kirana Store", "address": "Sector 15, Rohini", "phone": "9876543210"},
            {"name": "Karan Provision & General", "address": "Paschim Vihar", "phone": "9812345678"},
            {"name": "Sharma Supermarket Dwarka", "address": "Dwarka Sector 10", "phone": "9555667788"},
            {"name": "Bansal Departmental Store", "address": "Karol Bagh", "phone": "9666778899"},
            {"name": "Balaji Sweets & Provisions", "address": "Pitampura", "phone": "9777889900"}
        ]

        # Clear existing retailers to avoid duplicates for this demo
        db.query(Retailer).delete()

        retailers = []
        for r in retailers_data:
            retailers.append(Retailer(
                retailer_name=r["name"],
                address=r["address"],
                phone=r["phone"],
                assigned_staff_id=staff_id
            ))
        
        db.add_all(retailers)
        db.commit()
        print(f"✅ Successfully seeded {len(retailers)} retailers into the database!")
    except Exception as e:
        print(f"❌ Error seeding retailers: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_retailers()
