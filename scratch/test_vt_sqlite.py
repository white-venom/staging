import sys
import os
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

TEST_DB_FILE = "test_vt.db"
if os.path.exists(TEST_DB_FILE):
    try:
        os.remove(TEST_DB_FILE)
    except Exception:
        pass

from app.main import app
from app.database.db import Base, get_db
from app.core.security import get_password_hash
from app.database.models import User, PortalGroup, Portal, Retailer

DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

def run_test():
    db = TestingSessionLocal()
    try:
        pass_hash = get_password_hash("password123")
        admin_user = User(
            name="Owner Admin",
            phone="9999999999",
            role="admin",
            password_hash=pass_hash
        )
        staff_user = User(
            name="Staff Member",
            phone="8888888888",
            role="staff",
            password_hash=pass_hash
        )
        db.add_all([admin_user, staff_user])
        db.commit()

        # Seed Portal Group and Portal
        group = PortalGroup(name="Test Group", opening_to_give=0, opening_to_take=0, balance=100000)
        db.add(group)
        db.commit()
        
        portal = Portal(group_id=group.id, portal_name="Test Portal", bank_name="HDFC", bank_account_no="123", balance=50000)
        db.add(portal)
        db.commit()

        # Seed Retailer
        retailer = Retailer(retailer_name="Test Retailer", phone="9876543210", balance=0)
        db.add(retailer)
        db.commit()

        admin_id = admin_user.id
        staff_id = staff_user.id
        portal_id = portal.id
        retailer_id = retailer.id
    finally:
        db.close()

    # Login
    r_login = client.post("/auth/login", json={"phone": "9999999999", "password": "password123"})
    assert r_login.status_code == 200
    token = r_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}", "X-Tenant-ID": "test-tenant"}

    # Run virtual transfer to Retailer (Load)
    payload_retailer = {
        "portal_id": str(portal_id),
        "retailer_id": str(retailer_id),
        "amount": 5000.0,
        "remarks": "Load to Retailer",
        "direction": "load"
    }
    print("Testing virtual transfer to retailer...")
    res = client.post("/admin-settings/virtual-transfer", headers=headers, json=payload_retailer)
    print("Retailer transfer status:", res.status_code)
    print("Retailer transfer response:", res.text)
    assert res.status_code == 200

    # Run virtual transfer to Staff (Load)
    payload_staff = {
        "portal_id": str(portal_id),
        "staff_id": str(staff_id),
        "amount": 2000.0,
        "remarks": "Load to Staff",
        "direction": "load"
    }
    print("\nTesting virtual transfer to staff...")
    res = client.post("/admin-settings/virtual-transfer", headers=headers, json=payload_staff)
    print("Staff transfer status:", res.status_code)
    print("Staff transfer response:", res.text)
    assert res.status_code == 200

    # Clean up test db file
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except Exception:
            pass
    print("\nAll virtual transfer tests completed successfully!")

if __name__ == "__main__":
    run_test()
