import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field, model_validator


# NUMERIC(12,2) columns (Collection.total_amount, BankDeposit.amount,
# Denomination.online_amount) hold at most 10 integer digits + 2 decimal places.
# A value beyond that overflows the DB column and previously surfaced as a raw
# 500 ("An internal error occurred") instead of a clean validation error -- these
# bounds reject it at the request-validation layer instead.
NUMERIC_12_2_MAX = Decimal("9999999999.99")
NUMERIC_12_2_MIN = -NUMERIC_12_2_MAX
# Denomination.coins is NUMERIC(10,2): 8 integer digits + 2 decimal places.
NUMERIC_10_2_MAX = Decimal("99999999.99")
NUMERIC_10_2_MIN = -NUMERIC_10_2_MAX


class DenominationSchema(BaseModel):
    # Notes can be negative to represent note exchange (e.g. staff gave out ₹500s)
    # Bounded to prevent 32-bit integer overflow in database
    note_500: int = Field(0, ge=-1000000, le=1000000)
    note_200: int = Field(0, ge=-1000000, le=1000000)
    note_100: int = Field(0, ge=-1000000, le=1000000)
    note_50: int = Field(0, ge=-1000000, le=1000000)
    note_20: int = Field(0, ge=-1000000, le=1000000)
    note_10: int = Field(0, ge=-1000000, le=1000000)
    coins: Decimal = Field(Decimal("0.00"), ge=NUMERIC_10_2_MIN, le=NUMERIC_10_2_MAX)
    online_amount: Decimal = Field(Decimal("0.00"), ge=0, le=NUMERIC_12_2_MAX)
    online_bank_account_id: Optional[str] = None

    class Config:
        from_attributes = True


class CollectionCreate(BaseModel):
    retailer_id: Optional[uuid.UUID] = None
    from_staff_id: Optional[uuid.UUID] = None
    from_office: bool = False
    store_id: Optional[uuid.UUID] = None
    bank_account_id: Optional[uuid.UUID] = None
    # Must be positive; bounded to what the DB's NUMERIC(12,2) column can actually store.
    total_amount: Decimal = Field(..., gt=0, le=NUMERIC_12_2_MAX)
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
    mirror_deposit_id: Optional[uuid.UUID] = None
    online_routing_deposit_id: Optional[uuid.UUID] = None
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
    bank_account_name: Optional[str] = None
    portal_name: Optional[str] = None
    bank_name: Optional[str] = None

    class Config:
        from_attributes = True
