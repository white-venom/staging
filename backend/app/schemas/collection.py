import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field, model_validator


class DenominationSchema(BaseModel):
    # Notes can be negative to represent note exchange (e.g. staff gave out ₹500s)
    note_500: int = Field(0)
    note_200: int = Field(0)
    note_100: int = Field(0)
    note_50: int = Field(0)
    note_20: int = Field(0)
    note_10: int = Field(0)
    coins: Decimal = Field(Decimal("0.00"))
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
    total_amount: Decimal  # Can be zero (pure note exchange), negative (net outflow), or positive
    remarks: Optional[str] = Field(None, max_length=255)
    collection_date: Optional[date] = None
    denominations: DenominationSchema

    @model_validator(mode="after")
    def validate_denomination_sum(self) -> "CollectionCreate":
        d = self.denominations
        denom_sum = (
            Decimal(d.note_500) * 500 + Decimal(d.note_200) * 200 + Decimal(d.note_100) * 100 +
            Decimal(d.note_50) * 50 + Decimal(d.note_20) * 20 + Decimal(d.note_10) * 10 +
            d.coins + d.online_amount
        )
        if denom_sum != self.total_amount:
            raise ValueError(
                f"Denomination total (Rs.{denom_sum}) does not match collection amount (Rs.{self.total_amount})"
            )
        return self


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
    collection_date: date
    created_at: datetime
    denominations: Optional[DenominationSchema]
    
    # Virtual fields populated by router
    retailer_name: Optional[str] = None
    retailer_ledger_token: Optional[str] = None
    store_name: Optional[str] = None
    staff_name: Optional[str] = None
    from_staff_name: Optional[str] = None
    portal_name: Optional[str] = None
    portal_group_name: Optional[str] = None
    bank_name: Optional[str] = None

    class Config:
        from_attributes = True
