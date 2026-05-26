import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field, model_validator

from app.schemas.collection import DenominationSchema


class DepositCreate(BaseModel):
    deposit_type: str = Field(..., examples=["portal", "retailer", "staff"]) # 'portal', 'retailer', 'staff'
    portal_id: Optional[uuid.UUID] = None
    retailer_id: Optional[uuid.UUID] = None
    recipient_staff_id: Optional[uuid.UUID] = None
    to_office: bool = False
    
    payment_mode: str = Field("cash", examples=["cash", "online"])
    amount: Decimal = Field(..., gt=0)
    deposit_date: date = Field(default_factory=date.today)
    reference_no: Optional[str] = Field(None, max_length=100)
    denominations: Optional[DenominationSchema] = None

    @model_validator(mode="after")
    def validate_deposit_types(self) -> "DepositCreate":
        dt = self.deposit_type.lower().strip()
        if dt == "portal":
            if not self.portal_id:
                raise ValueError("portal_id is required for a portal bank deposit.")
        elif dt == "retailer":
            if not self.retailer_id:
                raise ValueError("retailer_id is required for a retailer payout.")
        elif dt == "staff":
            if not self.recipient_staff_id and not self.to_office:
                raise ValueError("Either recipient_staff_id or to_office must be set for a staff handover.")
        elif dt == "virtual":
            if not self.portal_id:
                raise ValueError("portal_id is required for a virtual transfer.")
            if not self.retailer_id:
                raise ValueError("retailer_id is required for a virtual transfer.")
        else:
            raise ValueError("deposit_type must be one of 'portal', 'retailer', 'staff', or 'virtual'.")
        return self


class DepositResponse(BaseModel):
    id: uuid.UUID
    staff_id: uuid.UUID
    deposit_type: str
    portal_id: Optional[uuid.UUID]
    retailer_id: Optional[uuid.UUID]
    recipient_staff_id: Optional[uuid.UUID]
    to_office: bool
    payment_mode: str
    amount: Decimal
    deposit_date: date
    created_at: datetime
    reference_no: Optional[str]
    status: str
    balance_snapshot: Decimal
    denominations: Optional[DenominationSchema]
    
    # Virtual fields populated by router
    target_name: Optional[str] = None
    portal_group_name: Optional[str] = None
    portal_group_id: Optional[uuid.UUID] = None
    staff_name: Optional[str] = None

    class Config:
        from_attributes = True
