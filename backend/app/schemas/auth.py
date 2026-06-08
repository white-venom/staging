import uuid
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class UserBase(BaseModel):
    name: str = Field(..., max_length=100, examples=["John Doe"])
    phone: str = Field(..., examples=["9876543210"])
    role: str = Field(..., examples=["staff"])  # 'admin', 'staff'

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        """Validate phone number format."""
        # Strips out any spaces or dashes
        cleaned = "".join(filter(str.isdigit, v))
        if len(cleaned) < 10 or len(cleaned) > 15:
            raise ValueError("Phone number must contain between 10 and 15 digits.")
        return cleaned

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        """Validate role matches permitted operational categories."""
        v_lower = v.lower().strip()
        if v_lower not in ["admin", "staff", "partner"]:
            raise ValueError("Role must be either 'admin', 'staff', or 'partner'.")
        return v_lower


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, examples=["secr3tpass"])


class UserUpdate(UserBase):
    password: Optional[str] = Field(None, min_length=6, examples=["secr3tpass"])


from decimal import Decimal

class UserResponse(UserBase):
    id: uuid.UUID
    virtual_balance: Decimal
    is_active: bool

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    phone: str = Field(..., examples=["9876543210"])
    password: str = Field(..., examples=["password123"])


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str
    id: uuid.UUID
