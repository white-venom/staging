import sys
import uuid
from decimal import Decimal
from datetime import datetime
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException, Response

# Setup module path resolution
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database.db import Base
from app.database.models import User
from app.core.security import get_password_hash, verify_password, create_access_token, decode_token
from app.schemas.auth import LoginRequest
from app.routers.auth import login, get_me
from app.dependencies import require_admin, require_staff


def run_auth_verification():
    print("🚀 Initializing Authentication & Encryption Verification Suite...")

    # 1. Test Argon2id Password Cryptography
    print("\n🔐 [Test 1] Verifying Argon2id Password Encryption...")
    raw_password = "StaffSecurePassword@123"
    print(f"   ↳ Raw Input: '{raw_password}'")
    
    hashed = get_password_hash(raw_password)
    print(f"   ↳ Scrambled Hash: {hashed[:40]}...")
    
    # Confirm correct password matches
    assert verify_password(raw_password, hashed) is True, "❌ Password verification failed for valid password!"
    print("   ✅ Correct password verified successfully!")
    
    # Confirm incorrect password fails
    assert verify_password("wrongpassword", hashed) is False, "❌ Security leak: incorrect password validated!"
    print("   ✅ Incorrect password rejected successfully!")

    # 2. Test JWT Token Creation & Secure Decodes
    print("\n🔑 [Test 2] Verifying JWT Token Generation & Validation...")
    user_id = uuid.uuid4()
    access_token = create_access_token(data={"sub": str(user_id)})
    print(f"   ↳ Generated Access Token: {access_token[:40]}...")
    
    decoded = decode_token(access_token, expected_type="access")
    assert decoded is not None, "❌ Token decoding failed!"
    assert decoded.get("sub") == str(user_id), "❌ Decoded subject does not match subject payload!"
    assert decoded.get("type") == "access", "❌ Decoded token type is incorrect!"
    print("   ✅ JWT Access Token verified, decoded, and scoped successfully!")

    # 3. Test Routing Login Flow with programmatic Mock Database Sessions
    print("\n🚪 [Test 3] Verifying Login Router & Session Cookie Injection...")
    engine = create_engine("sqlite:///:memory:", echo=False)
    SessionClass = sessionmaker(bind=engine)
    db_session = SessionClass()
    
    # Create tables
    Base.metadata.create_all(engine)
    
    # Insert mock staff user
    hashed_pass = get_password_hash("StaffPass123")
    mock_staff = User(
        name="Staff Member",
        phone="9876543210",
        role="staff",
        password_hash=hashed_pass
    )
    # Insert mock admin user
    hashed_admin = get_password_hash("AdminPass123")
    mock_admin = User(
        name="Admin Executive",
        phone="9999999999",
        role="admin",
        password_hash=hashed_admin
    )
    db_session.add_all([mock_staff, mock_admin])
    db_session.commit()

    # Model mock response capturing cookie flags
    class MockResponse(Response):
        def __init__(self):
            super().__init__()
            self.cookies_store = {}

        def set_cookie(self, key, value, httponly=False, secure=False, samesite="lax", max_age=None, path=None):
            self.cookies_store[key] = {
                "value": value,
                "httponly": httponly,
                "secure": secure,
                "samesite": samesite,
                "max_age": max_age,
                "path": path
            }

    # Execute Login for Staff
    class MockRequest:
        class URL:
            scheme = "http"
        url = URL()
        base_url = "http://localhost:8000"
        headers = {}

    mock_response = MockResponse()
    login_payload = LoginRequest(phone="9876543210", password="StaffPass123")
    
    login_result = login(login_data=login_payload, response=mock_response, request=MockRequest(), db=db_session)
    assert login_result["access_token"] is not None, "❌ Access Token not returned on login!"
    assert login_result["role"] == "staff", "❌ Returned role is incorrect!"
    print("   ✅ Access Token returned successfully for active user!")
    
    # Verify deactivated user cannot log in
    mock_staff.is_active = False
    db_session.commit()
    try:
        login(login_data=login_payload, response=mock_response, request=MockRequest(), db=db_session)
        print("   ❌ Security failure: Deactivated user was allowed to log in!")
        sys.exit(1)
    except HTTPException as ex:
        assert ex.status_code == 403, "❌ Deactivated login should return 403 Forbidden!"
        print("   ✅ Deactivated user rejected from logging in (403 Forbidden).")

    # Restore is_active status for subsequent tests
    mock_staff.is_active = True
    db_session.commit()

    # Verify HttpOnly Cookie was set
    cookie = mock_response.cookies_store.get("refresh_token")
    assert cookie is not None, "❌ Secure refresh_token cookie was NOT injected in response!"
    assert cookie["httponly"] is True, "❌ Vulnerability: Refresh cookie is NOT set as HttpOnly!"
    assert cookie["path"] == "/auth", "❌ Cookie scoping path is incorrect!"
    print("   ✅ Secure, HTTP-Only session refresh cookie injected with correct path scoping!")

    # 4. Test Role Guards & API Security Access Controls
    print("\n🛡️  [Test 4] Verifying Role-Based Access Guards...")
    
    # Test Staff Role validation
    print("   ↳ Testing staff guard with staff user:")
    try:
        require_staff(mock_staff)
        print("     ✅ Staff user allowed on staff route.")
    except HTTPException:
        print("     ❌ Staff user blocked on staff route!")
        sys.exit(1)

    print("   ↳ Testing admin guard with staff user:")
    try:
        require_admin(mock_staff)
        print("     ❌ Security error: Staff user was allowed on admin route!")
        sys.exit(1)
    except HTTPException as ex:
        assert ex.status_code == 403, "❌ Incorrect exception raised for permission violation!"
        print("     ✅ Staff user blocked from admin route (403 Forbidden).")

    # Test Admin Role validation
    print("   ↳ Testing admin guard with admin user:")
    try:
        require_admin(mock_admin)
        print("     ✅ Admin user allowed on admin route.")
    except HTTPException:
        print("     ❌ Admin user blocked on admin route!")
        sys.exit(1)

    print("\n🎉 SECURITY & AUTHENTICATION VERIFICATION COMPLETED SUCCESSFULLY! ZERO ERRORS.")
    db_session.close()


if __name__ == "__main__":
    run_auth_verification()
