import uuid
import time
from collections import defaultdict
from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.database.models import User
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse
from app.core.config import settings
from app.core.security import (
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token
)
from app.dependencies import get_current_user, check_maintenance_mode
from app.logic.audit import log_audit_event

router = APIRouter(prefix="/auth", tags=["Authentication"])

# In-memory login attempt tracker for rate limiting
_login_attempts: dict[str, list[float]] = defaultdict(list)


def _get_client_ip(request: Request) -> str:
    # Prefer direct socket IP unless running behind configured reverse proxy
    if request.client and request.client.host:
        return request.client.host
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return "unknown"


def _check_rate_limit(phone: str, client_ip: str, max_phone_attempts: int = 5, max_ip_attempts: int = 15, window_seconds: int = 60):
    now = time.time()

    # Periodic cleanup of keys older than window
    if len(_login_attempts) > 1000:
        for k in list(_login_attempts.keys()):
            _login_attempts[k] = [t for t in _login_attempts[k] if now - t < window_seconds]
            if not _login_attempts[k]:
                _login_attempts.pop(k, None)

    # 1. Per-phone rate limit check (prevents brute forcing one account from multiple IPs)
    phone_key = f"phone:{phone}"
    phone_valid = [t for t in _login_attempts[phone_key] if now - t < window_seconds]
    _login_attempts[phone_key] = phone_valid
    if len(phone_valid) >= max_phone_attempts:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts for this account. Please wait 1 minute before trying again."
        )

    # 2. Per-IP rate limit check (prevents sweeping multiple accounts from one IP)
    ip_key = f"ip:{client_ip}"
    ip_valid = [t for t in _login_attempts[ip_key] if now - t < window_seconds]
    _login_attempts[ip_key] = ip_valid
    if len(ip_valid) >= max_ip_attempts:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts from this network. Please wait 1 minute."
        )


def _record_failed_attempt(phone: str, client_ip: str):
    now = time.time()
    _login_attempts[f"phone:{phone}"].append(now)
    _login_attempts[f"ip:{client_ip}"].append(now)


def _clear_attempts(phone: str, client_ip: str):
    _login_attempts.pop(f"phone:{phone}", None)
    _login_attempts.pop(f"ip:{client_ip}", None)


@router.post("/login", response_model=TokenResponse)
def login(
    login_data: LoginRequest,
    response: Response,
    request: Request,
    db: Session = Depends(get_db)
):
    """Authenticate credentials, set secure HttpOnly refresh cookies, and return access token."""
    client_ip = _get_client_ip(request)
    _check_rate_limit(login_data.phone, client_ip)

    # Find user by unique phone number
    user = db.scalar(select(User).where(User.phone == login_data.phone))

    if not user or not verify_password(login_data.password, user.password_hash):
        _record_failed_attempt(login_data.phone, client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect phone number or password"
        )

    # Reset failed attempts on success
    _clear_attempts(login_data.phone, client_ip)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated"
        )

    # Check if maintenance mode is active for non-admin users
    check_maintenance_mode(request, user.role)

    log_audit_event(
        request, actor_type=user.role, action="login",
        actor_id=user.id, actor_name=user.name,
        entity_type="User", entity_id=user.id,
        description=f"{user.role.capitalize()} '{user.name}' logged in",
    )

    # Generate access & refresh tokens with current token_version
    token_ver = getattr(user, "token_version", 0)
    access_token = create_access_token(data={"sub": str(user.id), "token_version": token_ver})
    refresh_token = create_refresh_token(data={"sub": str(user.id), "token_version": token_ver})

    is_https = request.url.scheme == "https" or "onrender.com" in str(request.base_url)
    # Set refresh token in secure HttpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=is_https,
        samesite="none" if is_https else "lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/auth"   # Restrict cookie transmit scope to only auth-related endpoints
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "name": user.name,
        "id": user.id
    }


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """Authenticate HttpOnly refresh cookie, rotate refresh token, and return fresh access token."""
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing from session"
        )

    # Decode & validate refresh token
    payload = decode_token(refresh_token, expected_type="refresh")
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session"
        )

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_418_IM_A_TEAPOT,
            detail="Corrupted session payload"
        )

    # Query matching user
    user = db.scalar(select(User).where(User.id == uuid.UUID(user_id_str)))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session belongs to a non-existent user"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated"
        )

    # Validate token_version to prevent reuse of revoked/logged-out tokens (BUG-005)
    token_ver_in_token = payload.get("token_version")
    current_token_ver = getattr(user, "token_version", 0)
    if token_ver_in_token is not None and token_ver_in_token != current_token_ver:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been revoked. Please log in again."
        )

    # Rotate refresh & access tokens (Best security standard)
    new_access_token = create_access_token(data={"sub": str(user.id), "token_version": current_token_ver})
    new_refresh_token = create_refresh_token(data={"sub": str(user.id), "token_version": current_token_ver})

    is_https = request.url.scheme == "https" or "onrender.com" in str(request.base_url)
    # Set rotated cookie
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=is_https,
        samesite="none" if is_https else "lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/auth"
    )

    return {
        "access_token": new_access_token,
        "token_type": "bearer",
        "role": user.role,
        "name": user.name,
        "id": user.id
    }


@router.post("/logout")
def logout(
    response: Response,
    request: Request,
    db: Session = Depends(get_db)
):
    """Log out user by purging session cookies and incrementing token_version to revoke active tokens."""
    response.delete_cookie(key="refresh_token", path="/auth")

    # Invalidate server-side token version if refresh token or authorization header is present
    try:
        token_to_check = request.cookies.get("refresh_token")
        expected_type = "refresh"
        if not token_to_check:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token_to_check = auth_header[7:]
                expected_type = "access"

        if token_to_check:
            payload = decode_token(token_to_check, expected_type=expected_type)
            if payload and payload.get("sub"):
                u = db.scalar(select(User).where(User.id == uuid.UUID(payload.get("sub"))))
                if u:
                    u.token_version = getattr(u, "token_version", 0) + 1
                    db.commit()
    except Exception as e:
        print(f"[WARN] Error invalidating token on logout: {e}")

    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Fetch profile information of current logged-in session."""
    return current_user


from pydantic import BaseModel

class TicketExchangeRequest(BaseModel):
    ticket: str


@router.post("/exchange-ticket", response_model=TokenResponse)
def exchange_ticket(
    payload: TicketExchangeRequest,
    response: Response,
    request: Request,
    db: Session = Depends(get_db)
):
    """Safely exchange a single-use impersonation ticket for real session tokens (BUG-003)."""
    from app.core.security import consume_impersonation_ticket
    ticket_data = consume_impersonation_ticket(payload.ticket)
    if not ticket_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impersonation ticket is invalid or has expired"
        )

    user_id = uuid.UUID(ticket_data["user_id"])
    user = db.scalar(select(User).where(User.id == user_id))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive or not found"
        )

    # Check maintenance mode
    check_maintenance_mode(request, user.role)

    # Generate fresh access & refresh tokens
    token_ver = getattr(user, "token_version", 0)
    access_token = create_access_token(data={"sub": str(user.id), "token_version": token_ver})
    refresh_token = create_refresh_token(data={"sub": str(user.id), "token_version": token_ver})

    is_https = request.url.scheme == "https" or "onrender.com" in str(request.base_url)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=is_https,
        samesite="none" if is_https else "lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/auth"
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "name": user.name,
        "id": user.id
    }

