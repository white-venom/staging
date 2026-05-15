import sys
import os
import uuid
from decimal import Decimal

# Add the parent directory to sys.path to import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.db import SessionLocal
from app.database.models import Portal, PortalGroup

def migrate():
    db = SessionLocal()
    try:
        print("Starting Portal Balance Migration...")
        portals = db.query(Portal).all()
        for p in portals:
            # Initialize with 0.00 if they are NULL
            if p.opening_to_give is None: p.opening_to_give = Decimal("0.00")
            if p.opening_to_take is None: p.opening_to_take = Decimal("0.00")
            if p.balance is None: 
                p.balance = p.opening_to_take - p.opening_to_give
            
            print(f"Updated Portal: {p.portal_name} | Balance: {p.balance}")
        
        db.commit()
        print("Migration completed successfully!")
    except Exception as e:
        db.rollback()
        print(f"Error during migration: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
