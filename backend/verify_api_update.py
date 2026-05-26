import os
import sys

# Add backend directory to sys.path so we can import app modules
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

# Override settings DATABASE_URL to target docker bridge database IP
os.environ["DATABASE_URL"] = "postgresql://doit_admin:securepassword@172.18.0.2:5432/doit_production"

from fastapi.testclient import TestClient
from app.main import app

def test_api_update():
    client = TestClient(app)
    
    # 1. Login as Admin to get token
    # Let's try phone 7900671145
    print("Attempting login as admin with phone 7900671145...")
    login_res = client.post("/auth/login", json={"phone": "7900671145", "password": "password123"})
    if login_res.status_code != 200:
        print("Login with 7900671145 failed, trying 9999999999...")
        login_res = client.post("/auth/login", json={"phone": "9999999999", "password": "password123"})
        
    if login_res.status_code != 200:
        print(f"Failed to login: {login_res.status_code} - {login_res.text}")
        return
        
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("Logged in successfully!")
    
    # 2. Fetch portal groups via API
    groups_res = client.get("/portals/groups", headers=headers)
    if groups_res.status_code != 200:
        print(f"Failed to fetch groups: {groups_res.status_code} - {groups_res.text}")
        return
        
    groups = groups_res.json()
    print(f"Fetched {len(groups)} Portal Groups via API.")
    if not groups:
        print("No portal groups to update.")
        return
        
    target_group = groups[0]
    group_id = target_group["id"]
    print(f"Target Group: ID={group_id}, Name={target_group['name']}, Opening To Give={target_group['opening_to_give']}, Opening To Take={target_group['opening_to_take']}")
    
    # 3. Call PUT endpoint to update the group
    update_payload = {
        "name": target_group["name"],
        "opening_to_give": 10.0,
        "opening_to_take": 20.0
    }
    print(f"Sending PUT request to /portals/groups/{group_id} with payload: {update_payload}")
    update_res = client.put(f"/portals/groups/{group_id}", headers=headers, json=update_payload)
    print(f"Status Code: {update_res.status_code}")
    print(f"Response Body: {update_res.text}")

if __name__ == "__main__":
    test_api_update()
