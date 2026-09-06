from datetime import datetime, timedelta, timezone
from typing import Optional
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from jose import jwt, JWTError

from app.core.config import settings

# Initialize Argon2 Password Hasher with standard secure parameters
ph = PasswordHasher(
    time_cost=3,      # Number of passes
    memory_cost=65536, # Memory usage in KB (64MB)
    parallelism=4      # Number of threads
)


# --- PASSWORD CRYPTOGRAPHY (Argon2id) ---

def get_password_hash(password: str) -> str:
    """Hash a plain text password using Argon2id."""
    return ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain text password against its Argon2id hash."""
    try:
        return ph.verify(hashed_password, plain_password)
    except VerifyMismatchError:
        return False


# --- TOKEN SYSTEM (JWT) ---
import calendar

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generate a JWT access token for authentication."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": calendar.timegm(expire.utctimetuple()), "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generate a JWT refresh token for session rotation."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode.update({"exp": calendar.timegm(expire.utctimetuple()), "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def decode_token(token: str, expected_type: str = "access") -> Optional[dict]:
    """Decode and validate a JWT token, ensuring it matches the expected type."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != expected_type:
            return None
        return payload
    except JWTError:
        return None


# --- SINGLE-USE IMPERSONATION TICKETS (BUG-003 / BUG-QA-003) ---
import time
import uuid
from datetime import datetime, timezone, timedelta

_impersonation_tickets: dict[str, dict] = {}


def create_impersonation_ticket(user_id: str, subdomain: str, name: str, phone: str, role: str = "admin") -> str:
    """Issue a single-use 60-second exchange ticket instead of placing a raw 24h JWT in the URL."""
    ticket = uuid.uuid4().hex
    now_dt = datetime.now(timezone.utc)
    expires_dt = now_dt + timedelta(seconds=60)

    # Persist in Master DB for multi-worker / multi-container reliability
    try:
        from app.database.db import MasterSessionLocal
        from app.database.master_models import ImpersonationTicket
        with MasterSessionLocal() as mdb:
            db_ticket = ImpersonationTicket(
                ticket_token=ticket,
                subdomain=subdomain,
                user_id=str(user_id),
                user_role=role,
                name=name,
                phone=phone,
                expires_at=expires_dt,
                used=False
            )
            mdb.add(db_ticket)
            mdb.commit()
    except Exception as e:
        # Fallback to in-memory if master DB is unavailable
        pass

    _impersonation_tickets[ticket] = {
        "user_id": user_id,
        "subdomain": subdomain,
        "name": name,
        "phone": phone,
        "role": role,
        "expires_at": time.time() + 60.0  # 60 seconds validity
    }
    return ticket


def consume_impersonation_ticket(ticket: str) -> Optional[dict]:
    """Validate and consume a single-use impersonation ticket. Returns payload if valid, else None."""
    now_dt = datetime.now(timezone.utc)

    # Check Master DB first for multi-worker support
    try:
        from app.database.db import MasterSessionLocal
        from app.database.master_models import ImpersonationTicket
        from sqlalchemy import select
        with MasterSessionLocal() as mdb:
            db_ticket = mdb.scalar(
                select(ImpersonationTicket)
                .where(
                    ImpersonationTicket.ticket_token == ticket,
                    ImpersonationTicket.used == False,
                    ImpersonationTicket.expires_at >= now_dt
                )
            )
            if db_ticket:
                db_ticket.used = True
                mdb.commit()
                # Clear in-memory as well
                _impersonation_tickets.pop(ticket, None)
                return {
                    "user_id": db_ticket.user_id,
                    "subdomain": db_ticket.subdomain,
                    "name": db_ticket.name,
                    "phone": db_ticket.phone,
                    "role": db_ticket.user_role
                }
    except Exception:
        pass

    # In-memory fallback
    now = time.time()
    for k in list(_impersonation_tickets.keys()):
        if _impersonation_tickets[k]["expires_at"] < now:
            _impersonation_tickets.pop(k, None)

    ticket_data = _impersonation_tickets.pop(ticket, None)
    if ticket_data and ticket_data["expires_at"] >= now:
        return ticket_data
    return None

