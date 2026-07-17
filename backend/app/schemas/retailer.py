import uuid
from typing import Optional
from pydantic import BaseModel, Field, EmailStr


class RetailerBase(BaseModel):
    retailer_name: str = Field(..., max_length=150, examples=["Aggarwal Kirana Store"])
    address: str = Field(..., max_length=255, examples=["Sector 15, Dwarka"])
    assigned_staff_id: Optional[uuid.UUID] = Field(None, examples=["e3d166c3-1ff6-4279-88b1-1647413f99aa"])
    email: Optional[EmailStr] = Field(None, examples=["aggarwal.store@gmail.com"])
    # Required to match the DB's NOT NULL constraint on retailers.phone -- letting
    # this stay Optional here let requests through validation only to crash with a
    # raw psycopg2 NotNullViolation at insert time instead of a clean 422.
    phone: str = Field(..., max_length=20, examples=["9876543210"])
    category: Optional[str] = Field(None, max_length=100, examples=["Supermarket"])


class RetailerCreate(RetailerBase):
    opening_to_give: float = 0.0 # We owe them (Credit)
    opening_to_take: float = 0.0 # They owe us (Debit)


class RetailerUpdate(BaseModel):
    retailer_name: Optional[str] = Field(None, max_length=150)
    address: Optional[str] = Field(None, max_length=255)
    assigned_staff_id: Optional[uuid.UUID] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    opening_to_give: Optional[float] = None
    opening_to_take: Optional[float] = None
    category: Optional[str] = Field(None, max_length=100)


class RetailerResponse(RetailerBase):
    id: uuid.UUID
    ledger_token: str  # Unique public URL token
    opening_to_give: float
    opening_to_take: float
    balance: float = 0.00
    is_active: bool = True
    category: Optional[str] = None

    class Config:
        from_attributes = True


class StoreCreate(BaseModel):
    store_name: str = Field(..., max_length=150)
    address: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    new_retailer_id: Optional[uuid.UUID] = None


class StoreResponse(StoreCreate):
    id: uuid.UUID
    retailer_id: uuid.UUID

    class Config:
        from_attributes = True
