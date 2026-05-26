import uuid
from sqlalchemy import create_engine, select, delete, text
from sqlalchemy.orm import Session
from app.database.models import Base, PortalGroup, Portal

# Database connection engine imported from settings config
from app.database.db import engine

def setup_groups():
    # Ensure tables exist
    Base.metadata.create_all(engine)
    
    with Session(engine) as session:
        try:
            session.execute(text("DELETE FROM portals"))
            session.execute(text("DELETE FROM portal_groups"))
            session.commit()
            print("Cleared existing portals and groups in doit_services.db")
        except Exception as e:
            print(f"Notice: {e}")
        
        # Exactly 2 Portals
        portal_names = [
            "PayNearby",
            "RNFI"
        ]
        
        # Single bank account per portal
        common_banks = [
            "State Bank of India"
        ]
        
        for name in portal_names:
            group = PortalGroup(
                id=uuid.uuid4(),
                name=f"Portal {name}" if "Portal" not in name else name
            )
            session.add(group)
            session.flush() # get the id
            
            # Add the 1 bank account to each portal group
            for bank in common_banks:
                account = Portal(
                    id=uuid.uuid4(),
                    group_id=group.id,
                    portal_name=f"{bank} Account",
                    bank_name=bank,
                    bank_account_no=f"XXXX{str(uuid.uuid4().int)[:8]}",
                    ifsc_code="DEFAULT0001"
                )
                session.add(account)
        
        session.commit()
        print(f"Successfully added {len(portal_names)} Portals with 5 bank accounts each.")

if __name__ == "__main__":
    setup_groups()
