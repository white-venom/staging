import os
import sys

# Setup module path resolution
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

# Target docker database bridge IP
os.environ["DATABASE_URL"] = "postgresql://doit_admin:securepassword@172.18.0.2:5432/doit_production"

from fastapi.testclient import TestClient
from sqlalchemy import select
from app.database.db import SessionLocal
from app.database.models import User, PortalGroup, Portal
from app.core.security import create_access_token
from app.main import app

def test_additive_api():
    db = SessionLocal()
    try:
        # 1. Find Admin user and generate token
        admin = db.scalar(select(User).where(User.role == "admin"))
        if not admin:
            print("❌ Admin user not found in database.")
            return
            
        print(f"Generating access token for admin: {admin.name} (Phone: {admin.phone})")
        token = create_access_token(data={"sub": str(admin.id)})
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Get/create a Portal Group
        group = db.scalar(select(PortalGroup).order_by(PortalGroup.name))
        if not group:
            print("❌ No Portal Groups found in database.")
            return
            
        print(f"\n--- Portal Group Initial State ---")
        print(f"Name: {group.name}")
        print(f"Opening To Take: {group.opening_to_take}")
        print(f"Opening To Give: {group.opening_to_give}")
        print(f"Balance: {group.balance}")
        
        old_take = float(group.opening_to_take or 0)
        old_give = float(group.opening_to_give or 0)
        old_balance = float(group.balance or 0)
        
        # 3. Call update_portal_group via TestClient
        client = TestClient(app)
        
        # Add 100 to Take and 50 to Give
        payload = {
            "name": group.name,
            "opening_to_take": 100.0,
            "opening_to_give": 50.0
        }
        
        print(f"\nUpdating Portal Group via API PUT with payload: {payload}")
        res = client.put(f"/portals/groups/{group.id}", json=payload, headers=headers)
        
        assert res.status_code == 200, f"Update failed: {res.text}"
        data = res.json()
        
        print(f"--- Portal Group Updated State (API Response) ---")
        print(f"Name: {data['name']}")
        print(f"Opening To Take: {data['opening_to_take']}")
        print(f"Opening To Give: {data['opening_to_give']}")
        print(f"Balance: {data['balance']}")
        
        # Assertions to verify additive model
        assert float(data['opening_to_take']) == old_take + 100.0, "opening_to_take did not increment correctly!"
        assert float(data['opening_to_give']) == old_give + 50.0, "opening_to_give did not increment correctly!"
        # Running balance should be updated by delta_take only, NOT delta_take - delta_give
        assert float(data['balance']) == old_balance + 100.0, f"balance did not update correctly! Expected {old_balance + 100.0}, got {data['balance']}"
        
        print("\n✅ Portal Group API verification successful! All assertions passed.")
        
        # 4. Now let's test Portal Account creation and updates
        portal = db.scalar(select(Portal).where(Portal.group_id == group.id))
        if not portal:
            print("\nCreating a test Portal Account to verify...")
            p_res = client.post("/portals", json={
                "group_id": str(group.id),
                "portal_name": "Test Portal Account",
                "bank_name": "Test Bank",
                "bank_account_no": "9876543210",
                "ifsc_code": "TEST0123456",
                "opening_to_take": 200.0,
                "opening_to_give": 50.0
            }, headers=headers)
            assert p_res.status_code == 201, f"Create portal failed: {p_res.text}"
            portal_data = p_res.json()
            portal_id = portal_data["id"]
            
            # Initial balance should be opening_to_take (200.0) without subtracting opening_to_give (50.0)
            assert float(portal_data["balance"]) == 200.0, f"Portal initial balance incorrect: {portal_data['balance']}"
            print("✅ Portal Account created successfully with correct non-subtracted balance.")
        else:
            portal_id = portal.id
            
        db.refresh(portal)
        old_p_take = float(portal.opening_to_take or 0)
        old_p_give = float(portal.opening_to_give or 0)
        old_p_balance = float(portal.balance or 0)
        
        # Update Portal Account
        p_payload = {
            "portal_name": portal.portal_name,
            "bank_name": portal.bank_name,
            "bank_account_no": portal.bank_account_no,
            "ifsc_code": portal.ifsc_code,
            "group_id": str(group.id),
            "opening_to_take": 150.0,
            "opening_to_give": 30.0
        }
        
        print(f"\nUpdating Portal Account via API PUT with payload: {p_payload}")
        p_res = client.put(f"/portals/{portal_id}", json=p_payload, headers=headers)
        assert p_res.status_code == 200, f"Update portal failed: {p_res.text}"
        updated_p = p_res.json()
        
        print(f"--- Portal Account Updated State (API Response) ---")
        print(f"Portal Name: {updated_p['portal_name']}")
        print(f"Opening To Take: {updated_p['opening_to_take']}")
        print(f"Opening To Give: {updated_p['opening_to_give']}")
        print(f"Balance: {updated_p['balance']}")
        
        assert float(updated_p['opening_to_take']) == old_p_take + 150.0, "Portal opening_to_take did not increment correctly!"
        assert float(updated_p['opening_to_give']) == old_p_give + 30.0, "Portal opening_to_give did not increment correctly!"
        assert float(updated_p['balance']) == old_p_balance + 150.0, "Portal balance did not update correctly!"
        
        print("\n✅ Portal Account API verification successful! All assertions passed.")
        
    finally:
        db.close()

if __name__ == "__main__":
    test_additive_api()
