import sys
import os
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Set up module path resolution
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Clean up any lingering test DB
TEST_DB_FILE = "test_ops.db"
if os.path.exists(TEST_DB_FILE):
    try:
        os.remove(TEST_DB_FILE)
    except Exception:
        pass

from app.main import app
from app.database.db import Base, get_db
from app.core.security import get_password_hash
from app.database.models import User

# Setup Test Database (Static file SQLite for cross-thread multi-connection reliability)
DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create database tables
Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


# Bind the FastAPI application to use our test database override
app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


def seed_test_users():
    """Seed initial credentials so we can log in."""
    db = TestingSessionLocal()
    try:
        # Create hashed passwords
        pass_hash = get_password_hash("password123")
        
        # Seed Admin
        admin_user = User(
            name="Owner Admin",
            phone="9999999999",
            role="admin",
            password_hash=pass_hash
        )
        # Seed Staff A
        staff_a = User(
            name="Collection Staff A",
            phone="8888888888",
            role="staff",
            password_hash=pass_hash
        )
        # Seed Staff B
        staff_b = User(
            name="Collection Staff B",
            phone="7777777777",
            role="staff",
            password_hash=pass_hash
        )
        db.add_all([admin_user, staff_a, staff_b])
        db.commit()
    finally:
        db.close()


def test_core_operations_flow():
    print("\n" + "="*80)
    print("🚀 STARTING FASTAPI INTEGRATION SUITE — PHASE 3 CORE OPERATIONAL WORKFLOWS")
    print("="*80)

    # 1. Seed credentials
    seed_test_users()
    print("✅ Seeded Admin (9999999999), Staff A (8888888888), and Staff B (7777777777).")

    # 2. Login to acquire JWT Access Tokens
    # Admin Login
    r_admin = client.post("/auth/login", json={"phone": "9999999999", "password": "password123"})
    if r_admin.status_code != 200:
        print(f"❌ Admin login failed: {r_admin.status_code} - {r_admin.text}")
        sys.exit(1)
    token_admin = r_admin.json()["access_token"]
    headers_admin = {"Authorization": f"Bearer {token_admin}"}
    print("✅ Authenticated Admin.")

    # Staff A Login
    r_staff_a = client.post("/auth/login", json={"phone": "8888888888", "password": "password123"})
    assert r_staff_a.status_code == 200, f"Staff A login failed: {r_staff_a.text}"
    token_staff_a = r_staff_a.json()["access_token"]
    headers_staff_a = {"Authorization": f"Bearer {token_staff_a}"}
    print("✅ Authenticated Staff A.")

    # Staff B Login
    r_staff_b = client.post("/auth/login", json={"phone": "7777777777", "password": "password123"})
    assert r_staff_b.status_code == 200, f"Staff B login failed: {r_staff_b.text}"
    token_staff_b = r_staff_b.json()["access_token"]
    headers_staff_b = {"Authorization": f"Bearer {token_staff_b}"}
    print("✅ Authenticated Staff B.")

    # Get Staff User IDs for linking
    r_profile_a = client.get("/auth/me", headers=headers_staff_a)
    id_staff_a = r_profile_a.json()["id"]
    r_profile_b = client.get("/auth/me", headers=headers_staff_b)
    id_staff_b = r_profile_b.json()["id"]

    # 3a. Admin registers a Portal Group
    r_group = client.post("/portals/groups", headers=headers_admin, json={
        "name": "Test Portal Group"
    })
    assert r_group.status_code == 201
    id_group = r_group.json()["id"]
    print(f"✅ Admin created Portal Group with ID: {id_group}")

    # 3b. Admin registers a Portal (Store: Blinkit Store Sector 5)
    r_portal = client.post("/portals", headers=headers_admin, json={
        "group_id": id_group,
        "portal_name": "Blinkit Store Sector 5",
        "bank_name": "HDFC Bank",
        "bank_account_no": "50100412345678",
        "ifsc_code": "HDFC0000123"
    })
    assert r_portal.status_code == 201
    id_portal = r_portal.json()["id"]
    print(f"✅ Admin created Portal (Blinkit) with ID: {id_portal}")

    # 4. Admin registers a Retailer (Aggarwal Kirana) assigned to Staff A
    r_retailer = client.post("/retailers", headers=headers_admin, json={
        "retailer_name": "Aggarwal Kirana Store",
        "address": "Sector 15, Dwarka",
        "assigned_staff_id": id_staff_a,
        "email": "aggarwal.store@gmail.com",
        "phone": "9876543210"
    })
    assert r_retailer.status_code == 201
    id_retailer = r_retailer.json()["id"]
    ledger_token = r_retailer.json()["ledger_token"]
    print(f"✅ Admin registered Retailer (Aggarwal Kirana) with Secure Token: {ledger_token}")

    # 5. Staff A logs Attendance check-in (Mileage: 12540 KM)
    r_checkin = client.post("/attendance/check-in", headers=headers_staff_a, json={
        "start_km": 12540
    })
    assert r_checkin.status_code == 201
    print(f"✅ Staff A Checked In: Start KM = {r_checkin.json()['start_km']}")

    # 6. Staff A submits Collection (Total ₹15,200; Cash + Online mix)
    # Cash count:
    # 20 notes of 500 = 10,000
    # 10 notes of 200 = 2,000
    # 12 notes of 100 = 1,200
    # UPI Scan: 2,000
    # Total = 15,200
    collection_payload = {
        "retailer_id": id_retailer,
        "portal_id": id_portal,
        "total_amount": 15200.00,
        "remarks": "Regular collection check with UPI scan",
        "denominations": {
            "note_500": 20,
            "note_200": 10,
            "note_100": 12,
            "note_50": 0,
            "note_20": 0,
            "note_10": 0,
            "coins": 0.00,
            "online_amount": 2000.00
        }
    }
    r_coll = client.post("/collections", headers=headers_staff_a, json=collection_payload)
    if r_coll.status_code != 201:
        print(f"❌ Collection submission failed: {r_coll.status_code} - {r_coll.text}")
    assert r_coll.status_code == 201
    id_collection = r_coll.json()["id"]
    print(f"✅ Staff A logged a cash collection of ₹15,200 (Matches computed sum!).")

    # Verify that collection is 'pending' before verification
    assert r_coll.json()["status"] == "verified"

    # Test Collection submission rejection on total amount MISMATCH
    mismatch_payload = dict(collection_payload)
    mismatch_payload["total_amount"] = 99999.00  # Fake total
    r_coll_fail = client.post("/collections", headers=headers_staff_a, json=mismatch_payload)
    assert r_coll_fail.status_code == 400
    print("✅ Collection validation correctly rejected total mismatch payload.")

    # 7. Admin Verifies the Collection (SKIPPED: Now auto-verified upon submission as per Task 110)
    # r_verify = client.put(f"/collections/{id_collection}/verify", headers=headers_admin)
    # assert r_verify.status_code == 200
    # assert r_verify.json()["status"] == "verified"
    # print("✅ Admin verified the collection successfully (SMTP Email Logs verified above!).")

    # 8. Staff A performs Option C Staff Handover (Sends ₹3,200 cash to Staff B)
    # Handing over: 6 notes of 500 (= 3,000), 1 note of 200 (= 200). Total = 3,200.
    handover_payload = {
        "deposit_type": "staff",
        "recipient_staff_id": id_staff_b,
        "payment_mode": "cash",
        "amount": 3200.00,
        "denominations": {
            "note_500": 6,
            "note_200": 1,
            "note_100": 0,
            "note_50": 0,
            "note_20": 0,
            "note_10": 0,
            "coins": 0.00,
            "online_amount": 0.00
        }
    }
    r_dep = client.post("/bank-deposits", headers=headers_staff_a, json=handover_payload)
    assert r_dep.status_code == 201
    print(f"✅ Staff A logged Handover (Option C) of ₹{r_dep.json()['amount']} to Staff B.")

    # 9. Verify Real-Time Staff Pocket Cash & Note Details
    # Let's verify what Staff A currently has in their pocket:
    # Physical Collected Cash: (20*500 + 10*200 + 12*100) = 13,200
    # Handed Over Cash: (6*500 + 1*200) = 3,200
    # Pocket Physical Balance: 13,200 - 3,200 = 10,000
    # Notes in pocket breakdown:
    # 500: 20 - 6 = 14 notes
    # 200: 10 - 1 = 9 notes
    # 100: 12 - 0 = 12 notes
    r_cash_pocket = client.get("/staff/cash-in-hand", headers=headers_staff_a)
    assert r_cash_pocket.status_code == 200
    data_pocket = r_cash_pocket.json()
    assert data_pocket["total_pocket_cash"] == 10000.0
    assert data_pocket["note_breakdown"]["note_500"] == 14
    assert data_pocket["note_breakdown"]["note_200"] == 9
    assert data_pocket["note_breakdown"]["note_100"] == 12
    print(f"🥇 REAL-TIME CASH IN POCKET NOTES VERIFIED:")
    print(f"   ↳ Pocket Value: ₹{data_pocket['total_pocket_cash']}")
    print(f"   ↳ Pocket Notes: 500s: {data_pocket['note_breakdown']['note_500']}, 200s: {data_pocket['note_breakdown']['note_200']}, 100s: {data_pocket['note_breakdown']['note_100']}")

    # 10. Access secure Public Ledger view (With NO login)
    r_public = client.get(f"/public/ledger/{ledger_token}")
    assert r_public.status_code == 200
    data_public = r_public.json()
    assert len(data_public["statement_history"]) == 1
    assert data_public["outstanding_balance"] == -15200.00  # Debted down (Reducing outstanding)
    print(f"🥇 PUBLIC NO-LOGIN LEDGER ACCESS CONFIRMED:")
    print(f"   ↳ Vendor: {data_public['retailer_name']}")
    print(f"   ↳ Outstanding Debt: ₹{data_public['outstanding_balance']}")
    print(f"   ↳ Transaction: {data_public['statement_history'][0]['description']} (Amount: ₹{data_public['statement_history'][0]['amount']})")

    # 10.1 Test Cash Collection Description with Store Name
    print("🔄 Testing Cash-only Collection with Store Name in Ledger Description...")
    # Register a Store under the Retailer
    r_store = client.post(f"/retailers/{id_retailer}/stores", headers=headers_admin, json={
        "store_name": "Dwarka Sector 15 Outlet"
    })
    assert r_store.status_code == 201
    id_store = r_store.json()["id"]

    # Submit a cash-only collection linked to that store
    cash_collection_payload = {
        "retailer_id": id_retailer,
        "store_id": id_store,
        "total_amount": 5000.00,
        "remarks": "Cash-only collection from store",
        "denominations": {
            "note_500": 10,
            "note_200": 0,
            "note_100": 0,
            "note_50": 0,
            "note_20": 0,
            "note_10": 0,
            "coins": 0.00,
            "online_amount": 0.00
        }
    }
    r_cash_coll = client.post("/collections", headers=headers_staff_a, json=cash_collection_payload)
    assert r_cash_coll.status_code == 201
    id_cash_collection = r_cash_coll.json()["id"]

    # Fetch public ledger and assert description is the store name
    r_public_store = client.get(f"/public/ledger/{ledger_token}")
    assert r_public_store.status_code == 200
    data_public_store = r_public_store.json()
    # There should be 2 transactions now
    assert len(data_public_store["statement_history"]) == 2
    # Find the newly added transaction
    tx_store = [t for t in data_public_store["statement_history"] if t["amount"] == 5000.0]
    assert len(tx_store) == 1
    assert tx_store[0]["description"] == "Dwarka Sector 15 Outlet", f"Expected description 'Dwarka Sector 15 Outlet', got '{tx_store[0]['description']}'"
    print("   ↳ Checked: Ledger entry description correctly shows Store Name.")

    # Delete the temporary cash collection to restore balances
    r_del_cash = client.delete(f"/collections/{id_cash_collection}", headers=headers_staff_a)
    assert r_del_cash.status_code == 204
    print("   ↳ Deleted temporary cash collection successfully.")

    # 10c. Test Collection Edit & In-place Portal Deposit Sync (Point 8)
    print("🔄 Testing Collection Update & In-place Deposit Sync...")
    # Fetch existing portal deposit
    r_deps_init = client.get("/bank-deposits", headers=headers_staff_a)
    assert r_deps_init.status_code == 200
    portal_deps_init = [d for d in r_deps_init.json() if d["deposit_type"] == "portal"]
    assert len(portal_deps_init) == 1, f"Expected 1 portal deposit, got {len(portal_deps_init)}"
    id_portal_deposit = portal_deps_init[0]["id"]
    print(f"   ↳ Found auto-created portal deposit ID: {id_portal_deposit} with amount: ₹{portal_deps_init[0]['amount']}")

    # Create another Portal to test changing the portal bank
    r_portal_zepto = client.post("/portals", headers=headers_admin, json={
        "group_id": id_group,
        "portal_name": "Zepto Store Sector 10",
        "bank_name": "ICICI Bank",
        "bank_account_no": "60100412345678",
        "ifsc_code": "ICIC0000123"
    })
    assert r_portal_zepto.status_code == 201
    id_portal_zepto = r_portal_zepto.json()["id"]

    # Update the collection to change portal and increase online amount
    update_payload = {
        "retailer_id": id_retailer,
        "portal_id": id_portal_zepto,
        "total_amount": 16200.00,
        "remarks": "Updated collection check with UPI scan",
        "denominations": {
            "note_500": 20,
            "note_200": 10,
            "note_100": 12,
            "note_50": 0,
            "note_20": 0,
            "note_10": 0,
            "coins": 0.00,
            "online_amount": 3000.00
        }
    }
    r_update = client.put(f"/collections/{id_collection}", headers=headers_staff_a, json=update_payload)
    assert r_update.status_code == 200, f"Collection update failed: {r_update.text}"
    print("   ↳ Collection updated successfully to ₹16,200 (Online: ₹3,000 via Zepto).")

    # Verify that the portal deposit was updated in-place (same ID)
    r_deps_updated = client.get("/bank-deposits", headers=headers_staff_a)
    portal_deps_updated = [d for d in r_deps_updated.json() if d["id"] == id_portal_deposit]
    assert len(portal_deps_updated) == 1, "Deposit with original ID not found after update!"
    assert float(portal_deps_updated[0]["amount"]) == 3000.0, f"Expected amount 3000.0, got {portal_deps_updated[0]['amount']}"
    assert portal_deps_updated[0]["portal_id"] == id_portal_zepto, "Portal ID did not update on the deposit!"
    print("   ↳ Checked: Deposit was updated in-place (retained ID, updated portal and amount).")

    # Update collection to have zero online amount (cash-only)
    cash_only_payload = {
        "retailer_id": id_retailer,
        "portal_id": None,
        "total_amount": 13200.00,
        "remarks": "Updated collection to cash only",
        "denominations": {
            "note_500": 20,
            "note_200": 10,
            "note_100": 12,
            "note_50": 0,
            "note_20": 0,
            "note_10": 0,
            "coins": 0.00,
            "online_amount": 0.00
        }
    }
    r_update_cash = client.put(f"/collections/{id_collection}", headers=headers_staff_a, json=cash_only_payload)
    assert r_update_cash.status_code == 200, f"Cash-only update failed: {r_update_cash.text}"
    print("   ↳ Collection updated to cash-only (₹13,200).")

    # Verify that the portal deposit has been deleted
    r_deps_cash_only = client.get("/bank-deposits", headers=headers_staff_a)
    portal_deps_cash_only = [d for d in r_deps_cash_only.json() if d["id"] == id_portal_deposit]
    assert len(portal_deps_cash_only) == 0, "Portal deposit was not deleted after shifting to cash-only!"
    print("   ↳ Checked: Auto-created deposit was deleted successfully.")

    # Restore collection back to the initial state to ensure subsequent tests pass unchanged
    restore_payload = {
        "retailer_id": id_retailer,
        "portal_id": id_portal,
        "total_amount": 15200.00,
        "remarks": "Regular collection check with UPI scan",
        "denominations": {
            "note_500": 20,
            "note_200": 10,
            "note_100": 12,
            "note_50": 0,
            "note_20": 0,
            "note_10": 0,
            "coins": 0.00,
            "online_amount": 2000.00
        }
    }
    r_restore = client.put(f"/collections/{id_collection}", headers=headers_staff_a, json=restore_payload)
    assert r_restore.status_code == 200, f"Restoring collection failed: {r_restore.text}"
    print("   ↳ Restored collection to initial state for subsequent test assertions.")

    # 10b. Test GET /staff/daily-summary endpoint
    import datetime
    today_str = datetime.datetime.utcnow().date().isoformat()
    r_summary = client.get(f"/staff/daily-summary?selected_date={today_str}", headers=headers_staff_a)
    assert r_summary.status_code == 200, f"Daily summary failed: {r_summary.text}"
    summary_data = r_summary.json()
    print("DEBUG: summary_data is", summary_data)
    assert summary_data["opening_balance"] == 0.0
    assert summary_data["total_in"] == 15200.0
    assert summary_data["total_out"] == 5200.0
    assert summary_data["closing_balance"] == 10000.0
    print(f"🥇 DAILY SUMMARY BALANCES VERIFIED:")
    print(f"   ↳ Opening Balance: ₹{summary_data['opening_balance']}")
    print(f"   ↳ Total In: ₹{summary_data['total_in']}")
    print(f"   ↳ Total Out: ₹{summary_data['total_out']}")
    print(f"   ↳ Closing Balance: ₹{summary_data['closing_balance']}")


    # 11. Staff A checks out (KM: 12610)
    r_checkout = client.post("/attendance/check-out", headers=headers_staff_a, json={
        "end_km": 12610
    })
    assert r_checkout.status_code == 200
    assert r_checkout.json()["status"] == "completed"
    print(f"✅ Staff A Checked Out: End KM = {r_checkout.json()['end_km']}. Shift completed successfully!")

    print("\n" + "="*80)
    print("🎉 FASTAPI OPERATIONAL SYSTEM TEST PASSED WITH 100% RELATIONAL INTEGRITY!")
    print("="*80 + "\n")

    # Cleanup Database file
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except Exception:
            pass


if __name__ == "__main__":
    test_core_operations_flow()
