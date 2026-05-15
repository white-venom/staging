import sys
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Set up module path resolution
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database.models import Portal
from app.database.db import SessionLocal

def seed_portals():
    db = SessionLocal()
    try:
        portals_data = [
            {"name": "Blinkit Store Sector 5", "bank": "HDFC Bank", "acc": "50100123456789"},
            {"name": "Muthoot Office West", "bank": "ICICI Bank", "acc": "000105001234"},
            {"name": "Zomato Center North", "bank": "SBI", "acc": "31234567890"},
            {"name": "Direct Cash Office Handover", "bank": "N/A", "acc": "N/A"}
        ]

        # 1. Create a default Portal Group
        from app.database.models import PortalGroup
        import uuid
        
        # Clear existing
        db.query(Portal).delete()
        db.query(PortalGroup).delete()
        db.commit()

        default_group = PortalGroup(
            name="Main Operations Group",
            opening_to_give=0,
            opening_to_take=0,
            balance=0
        )
        db.add(default_group)
        db.commit()
        db.refresh(default_group)

        portals = []
        for p in portals_data:
            portals.append(Portal(
                group_id=default_group.id,
                portal_name=p["name"],
                bank_name=p["bank"],
                bank_account_no=p["acc"]
            ))
        
        db.add_all(portals)
        db.commit()
        print(f"✅ Successfully seeded {len(portals)} portals!")
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_portals()
