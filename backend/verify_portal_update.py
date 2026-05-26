import os
import sys
import socket

# Add backend directory to sys.path so we can import app modules
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from sqlalchemy.orm import Session
from app.database.db import SessionLocal
from app.database.models import PortalGroup
from sqlalchemy import select, create_engine

def find_db_and_test():
    credentials = "doit_admin:securepassword"
    dbname = "doit_production"
    
    # Scan IPs on docker subnet
    target_ip = None
    for i in range(2, 11):
        ip = f"172.18.0.{i}"
        print(f"Testing connection to {ip}:5432...")
        try:
            # First, check if port is open
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(0.5)
            result = s.connect_ex((ip, 5432))
            s.close()
            if result == 0:
                print(f"Port 5432 is OPEN on {ip}!")
                target_ip = ip
                break
        except Exception:
            pass
            
    if not target_ip:
        print("Could not find any database container with open port 5432 on subnet 172.18.0.x.")
        return
        
    db_url = f"postgresql://{credentials}@{target_ip}:5432/{dbname}"
    print(f"Connecting to database at {db_url}...")
    
    engine = create_engine(db_url)
    db = Session(bind=engine)
    try:
        # 1. Fetch all portal groups
        stmt = select(PortalGroup)
        groups = db.scalars(stmt).all()
        print(f"Found {len(groups)} Portal Groups:")
        for g in groups:
            print(f"- ID: {g.id}, Name: {g.name}, Balance: {g.balance}, Opening To Give: {g.opening_to_give}, Opening To Take: {g.opening_to_take}")
        
        if not groups:
            print("No Portal Groups found to test update.")
            return

        # 2. Try to update the first group
        test_group = groups[0]
        print(f"\nAttempting test update on Portal Group '{test_group.name}'...")
        old_name = test_group.name
        old_to_give = test_group.opening_to_give
        old_to_take = test_group.opening_to_take
        
        test_group.name = old_name
        test_group.opening_to_give = old_to_give
        test_group.opening_to_take = old_to_take
        
        db.commit()
        db.refresh(test_group)
        print("Success! Test update committed successfully on the docker container database.")
        
    except Exception as e:
        db.rollback()
        print("DB update failed with exception:")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    find_db_and_test()
