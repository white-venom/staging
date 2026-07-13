import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from app.schemas.bank_account import BankAccountResponse


class PortalBase(BaseModel):
    name: str = Field(..., max_length=100, examples=["RevaPay"])


class PortalCreate(PortalBase):
    opening_to_give: float = 0.0
    opening_to_take: float = 0.0
    show_in_online_payment: bool = False


class PortalUpdate(PortalBase):
    opening_to_give: Optional[float] = None
    opening_to_take: Optional[float] = None
    show_in_online_payment: Optional[bool] = None


class PortalResponse(PortalBase):
    id: uuid.UUID
    created_at: datetime
    opening_to_give: float
    opening_to_take: float
    balance: float
    bank_accounts: List[BankAccountResponse] = []

    class Config:
        from_attributes = True
