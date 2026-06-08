import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field


class DenominationSchema(BaseModel):
    note_500: int = Field(0, ge=0)
    note_200: int = Field(0, ge=0)
    note_100: int = Field(0, ge=0)
    note_50: int = Field(0, ge=0)
    note_20: int = Field(0, ge=0)
    note_10: int = Field(0, ge=0)
    coins: Decimal = Field(Decimal("0.00"), ge=0)
    online_amount: Decimal = Field(Decimal("0.00"), ge=0)
    online_portal_id: Optional[str] = None

    class Config:
        from_attributes = True


class CollectionCreate(BaseModel):
    retailer_id: Optional[uuid.UUID] = None
    from_staff_id: Optional[uuid.UUID] = None
    from_office: bool = False
    store_id: Optional[uuid.UUID] = None
    portal_id: Optional[uuid.UUID] = None
    total_amount: Decimal = Field(..., gt=0)
    remarks: Optional[str] = Field(None, max_length=255)
    denominations: DenominationSchema


class CollectionResponse(BaseModel):
    id: uuid.UUID
    retailer_id: Optional[uuid.UUID]
    staff_id: uuid.UUID
    from_staff_id: Optional[uuid.UUID] = None
    from_office: bool = False
    store_id: Optional[uuid.UUID]
    total_amount: Decimal
    remarks: Optional[str]
    status: str
    balance_snapshot: Decimal
    created_at: datetime
    denominations: Optional[DenominationSchema]
    
    # Virtual fields populated by router
    retailer_name: Optional[str] = None
    store_name: Optional[str] = None
    staff_name: Optional[str] = None
    from_staff_name: Optional[str] = None
    portal_name: Optional[str] = None

    class Config:
        from_attributes = True
