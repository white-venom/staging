import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field, model_validator

from app.schemas.collection import DenominationSchema
from app.core.timezone import ist_today


class DepositCreate(BaseModel):
    deposit_type: str = Field(..., examples=["portal", "retailer", "staff"])  # 'portal', 'retailer', 'staff', 'virtual', 'portal_transfer'
    portal_id: Optional[uuid.UUID] = None
    from_portal_id: Optional[uuid.UUID] = None  # Source portal for portal_transfer type
    retailer_id: Optional[uuid.UUID] = None
    recipient_staff_id: Optional[uuid.UUID] = None
    to_office: bool = False
    
    payment_mode: str = Field("cash", examples=["cash", "online"])
    amount: Decimal = Field(..., gt=0)
    deposit_date: date = Field(default_factory=ist_today)
    reference_no: Optional[str] = Field(None, max_length=100)
    remarks: Optional[str] = Field(None, max_length=255)
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
            if not self.retailer_id and not self.recipient_staff_id:
                raise ValueError("Either retailer_id or recipient_staff_id is required for a virtual transfer.")
        elif dt == "portal_transfer":
            if not self.portal_id:
                raise ValueError("portal_id (destination portal) is required for a portal-to-portal transfer.")
            if not self.from_portal_id:
                raise ValueError("from_portal_id (source portal) is required for a portal-to-portal transfer.")
            if self.portal_id == self.from_portal_id:
                raise ValueError("Source and destination portals must be different.")
        else:
            raise ValueError("deposit_type must be one of 'portal', 'retailer', 'staff', 'virtual', or 'portal_transfer'.")
        return self


class DepositResponse(BaseModel):
    id: uuid.UUID
    staff_id: uuid.UUID
    deposit_type: str
    portal_id: Optional[uuid.UUID]
    from_portal_id: Optional[uuid.UUID] = None
    retailer_id: Optional[uuid.UUID]
    recipient_staff_id: Optional[uuid.UUID]
    to_office: bool
    payment_mode: str
    amount: Decimal
    deposit_date: date
    created_at: datetime
    reference_no: Optional[str]
    remarks: Optional[str]
    status: str
    balance_snapshot: Decimal
    denominations: Optional[DenominationSchema]
    
    # Virtual fields populated by router
    target_name: Optional[str] = None
    portal_name: Optional[str] = None
    portal_group_name: Optional[str] = None
    portal_group_id: Optional[uuid.UUID] = None
    bank_name: Optional[str] = None
    from_portal_name: Optional[str] = None  # Source portal name for portal_transfer type
    from_portal_group_name: Optional[str] = None  # Source portal group name for portal_transfer type
    staff_name: Optional[str] = None
    is_refund: Optional[bool] = None  # True when this is a "Move to Distributor" reverse transfer
    retailer_ledger_token: Optional[str] = None

    class Config:
        from_attributes = True
