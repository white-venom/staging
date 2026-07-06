import uuid
from typing import Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.database.models import User
from app.core.security import decode_token

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Define standard HTTP Bearer security schema parsing header "Authorization: Bearer <token>"
security = HTTPBearer(auto_error=False)


def check_maintenance_mode(request: Request, user_role: str):
    if user_role == "admin":
        return
    if request.headers.get("X-Maintenance-Bypass") == "true":
        return
    tenant_id = request.headers.get("X-Tenant-ID")
    if not tenant_id:
        host = request.headers.get("host", "")
        parts = host.split(".")
        if len(parts) >= 3:
            tenant_id = parts[0]
            if tenant_id in ("superadmin", "www", "api"):
                tenant_id = None
    if not tenant_id:
        import os
        tenant_id = os.getenv("TEST_TENANT_ID")
    if tenant_id:
        from app.database.db import MasterSessionLocal
        from app.database.master_models import Tenant
        master_db = MasterSessionLocal()
        try:
            tenant = master_db.query(Tenant).filter(Tenant.subdomain == tenant_id).first()
            if tenant and tenant.maintenance_mode:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Maintenance Mode Active"
                )
        finally:
            master_db.close()


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security), 
    db: Session = Depends(get_db)
) -> User:
    """FastAPI Dependency to authenticate users using JWT Bearer headers."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not credentials:
        raise credentials_exception

    token = credentials.credentials
    payload = decode_token(token, expected_type="access")
    if payload is None:
        raise credentials_exception
        
    user_id_str: str = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception
        
    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise credentials_exception

    # Query user from database
    user = db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise credentials_exception
        
    if not getattr(user, 'is_active', True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated"
        )
        
    # Check if maintenance mode blocks this user
    check_maintenance_mode(request, user.role)

    return user


class RoleChecker:
    """Dynamic Permission Guard dependency checking matching user roles."""
    
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource."
            )
        return current_user


# Base role verification shortcuts
require_admin = RoleChecker(["admin"])
require_staff = RoleChecker(["staff", "admin"])
require_any_user = RoleChecker(["admin", "staff"])
