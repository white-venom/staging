import uuid
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, Field, field_validator


class UserBase(BaseModel):
    name: str = Field(..., max_length=100, examples=["John Doe"])
    phone: str = Field(..., examples=["9876543210"])
    role: str = Field(..., examples=["staff"])  # 'admin', 'staff'
    late_threshold: Optional[str] = Field(None, max_length=10, examples=["10:00"])
    late_penalty: Optional[float] = Field(None, examples=[100.0])
    auto_checkout_time: Optional[str] = Field(None, max_length=10, examples=["20:00"])

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
        if v_lower not in ["admin", "staff"]:
            raise ValueError("Role must be either 'admin' or 'staff'.")
        return v_lower


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=128, examples=["secr3tpass"])


class UserUpdate(UserBase):
    password: Optional[str] = Field(None, min_length=6, max_length=128, examples=["secr3tpass"])


class UserResponse(UserBase):
    id: uuid.UUID
    virtual_balance: Decimal
    is_active: bool

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    phone: str = Field(..., examples=["9876543210"])
    password: str = Field(..., min_length=1, max_length=128, examples=["password123"])

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        """Validate phone number format."""
        cleaned = "".join(filter(str.isdigit, v))
        if len(cleaned) < 10 or len(cleaned) > 15:
            raise ValueError("Phone number must contain between 10 and 15 digits.")
        return cleaned


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str
    id: uuid.UUID
