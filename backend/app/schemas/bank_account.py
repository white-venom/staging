import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class BankAccountBase(BaseModel):
    bank_account_name: str = Field(..., max_length=100, examples=["Main Account"])
    bank_name: Optional[str] = Field(None, max_length=100, examples=["HDFC Bank"])
    bank_account_no: Optional[str] = Field(None, max_length=100, examples=["50100412345678"])
    ifsc_code: Optional[str] = Field(None, max_length=20, examples=["HDFC0000123"])
    show_in_online_payment: bool = False


class BankAccountCreate(BankAccountBase):
    group_id: uuid.UUID
    opening_to_give: float = 0.0
    opening_to_take: float = 0.0


class BankAccountUpdate(BankAccountBase):
    group_id: Optional[uuid.UUID] = None
    opening_to_give: Optional[float] = None
    opening_to_take: Optional[float] = None
    show_in_online_payment: Optional[bool] = None


class BankAccountResponse(BankAccountBase):
    id: uuid.UUID
    group_id: Optional[uuid.UUID]
    group_name: Optional[str] = None
    created_at: datetime
    opening_to_give: float
    opening_to_take: float
    balance: float

    class Config:
        from_attributes = True
