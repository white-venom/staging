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
    portal_id: uuid.UUID
    # Only meaningful at creation time, to seed the PARENT Portal's opening
    # figures with whatever this physical account already held (e.g. onboarding
    # an existing bank account with money in it) -- see item #8. Never stored on
    # the BankAccount itself; BankAccount carries no balance of its own.
    opening_to_give: float = 0.0
    opening_to_take: float = 0.0


class BankAccountUpdate(BankAccountBase):
    portal_id: Optional[uuid.UUID] = None
    show_in_online_payment: Optional[bool] = None


class BankAccountResponse(BankAccountBase):
    id: uuid.UUID
    portal_id: Optional[uuid.UUID]
    portal_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
