import uuid
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
from app.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(
    login_data: LoginRequest,
    response: Response,
    request: Request,
    db: Session = Depends(get_db)
):
    """Authenticate credentials, set secure HttpOnly refresh cookies, and return access token."""
    # Find user by unique phone number
    user = db.scalar(select(User).where(User.phone == login_data.phone))
    
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect phone number or password"
        )

    # Generate access & refresh tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

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
        "name": user.name
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

    # Rotate refresh & access tokens (Best security standard)
    new_access_token = create_access_token(data={"sub": str(user.id)})
    new_refresh_token = create_refresh_token(data={"sub": str(user.id)})

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
        "name": user.name
    }


@router.post("/logout")
def logout(response: Response):
    """Log out user by purging session cookies."""
    response.delete_cookie(key="refresh_token", path="/auth")
    return {"message": "Logged out successfully"}



@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Fetch profile information of current logged-in session."""
    return current_user
