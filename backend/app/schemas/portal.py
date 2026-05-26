import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class PortalGroupBase(BaseModel):
    name: str = Field(..., max_length=100, examples=["RevaPay"])


class PortalGroupCreate(PortalGroupBase):
    opening_to_give: float = 0.0
    opening_to_take: float = 0.0


class PortalGroupUpdate(PortalGroupBase):
    opening_to_give: Optional[float] = None
    opening_to_take: Optional[float] = None


class PortalBase(BaseModel):
    portal_name: str = Field(..., max_length=100, examples=["Main Account"])
    bank_name: Optional[str] = Field(None, max_length=100, examples=["HDFC Bank"])
    bank_account_no: Optional[str] = Field(None, max_length=100, examples=["50100412345678"])
    ifsc_code: Optional[str] = Field(None, max_length=20, examples=["HDFC0000123"])


class PortalCreate(PortalBase):
    group_id: uuid.UUID
    opening_to_give: float = 0.0
    opening_to_take: float = 0.0


class PortalUpdate(PortalBase):
    group_id: Optional[uuid.UUID] = None
    opening_to_give: Optional[float] = None
    opening_to_take: Optional[float] = None


class PortalResponse(PortalBase):
    id: uuid.UUID
    group_id: Optional[uuid.UUID]
    created_at: datetime
    opening_to_give: float
    opening_to_take: float
    balance: float

    class Config:
        from_attributes = True


class PortalGroupResponse(PortalGroupBase):
    id: uuid.UUID
    created_at: datetime
    opening_to_give: float
    opening_to_take: float
    balance: float
    portals: List[PortalResponse] = []

    class Config:
        from_attributes = True
