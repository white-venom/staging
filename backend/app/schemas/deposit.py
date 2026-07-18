import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field, model_validator

from app.schemas.collection import DenominationSchema, NUMERIC_12_2_MAX
from app.core.timezone import ist_today


class DepositCreate(BaseModel):
    deposit_type: str = Field(..., examples=["portal", "retailer", "staff"])  # 'portal', 'retailer', 'staff', 'virtual', 'portal_transfer'
    bank_account_id: Optional[uuid.UUID] = None
    from_bank_account_id: Optional[uuid.UUID] = None  # Source account for portal_transfer type
    retailer_id: Optional[uuid.UUID] = None
    recipient_staff_id: Optional[uuid.UUID] = None
    to_office: bool = False

    payment_mode: str = Field("cash", examples=["cash", "online"])
    # Bounded to what the DB's NUMERIC(12,2) column can actually store.
    amount: Decimal = Field(..., gt=0, le=NUMERIC_12_2_MAX)
    deposit_date: date = Field(default_factory=ist_today)
    reference_no: Optional[str] = Field(None, max_length=100)
    remarks: Optional[str] = Field(None, max_length=255)
    denominations: Optional[DenominationSchema] = None

    @model_validator(mode="after")
    def validate_deposit_types(self) -> "DepositCreate":
        dt = self.deposit_type.lower().strip()
        if dt == "portal":
            if not self.bank_account_id:
                raise ValueError("bank_account_id is required for a bank deposit.")
        elif dt == "retailer":
            if not self.retailer_id:
                raise ValueError("retailer_id is required for a retailer payout.")
        elif dt == "staff":
            if not self.recipient_staff_id and not self.to_office:
                raise ValueError("Either recipient_staff_id or to_office must be set for a staff handover.")
        elif dt == "virtual":
            if not self.bank_account_id:
                raise ValueError("bank_account_id is required for a virtual transfer.")
            if not self.retailer_id and not self.recipient_staff_id:
                raise ValueError("Either retailer_id or recipient_staff_id is required for a virtual transfer.")
        elif dt == "portal_transfer":
            if not self.bank_account_id:
                raise ValueError("bank_account_id (destination account) is required for an account-to-account transfer.")
            if not self.from_bank_account_id:
                raise ValueError("from_bank_account_id (source account) is required for an account-to-account transfer.")
            if self.bank_account_id == self.from_bank_account_id:
                raise ValueError("Source and destination accounts must be different.")
        else:
            raise ValueError("deposit_type must be one of 'portal', 'retailer', 'staff', 'virtual', or 'portal_transfer'.")
        return self

    @model_validator(mode="after")
    def validate_denomination_sum(self) -> "DepositCreate":
        d = self.denominations
        if d is not None:
            denom_sum = (
                Decimal(d.note_500) * 500 + Decimal(d.note_200) * 200 + Decimal(d.note_100) * 100 +
                Decimal(d.note_50) * 50 + Decimal(d.note_20) * 20 + Decimal(d.note_10) * 10 +
                d.coins + d.online_amount
            )
            if denom_sum != self.amount:
                raise ValueError(
                    f"Denomination total (Rs.{denom_sum}) does not match deposit amount (Rs.{self.amount})"
                )
        return self


class DepositResponse(BaseModel):
    id: uuid.UUID
    staff_id: uuid.UUID
    deposit_type: str
    bank_account_id: Optional[uuid.UUID]
    from_bank_account_id: Optional[uuid.UUID] = None
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
    bank_account_name: Optional[str] = None
    portal_name: Optional[str] = None
    portal_id: Optional[uuid.UUID] = None
    bank_name: Optional[str] = None
    from_bank_account_name: Optional[str] = None  # Source account name for portal_transfer type
    from_portal_name: Optional[str] = None  # Source portal group name for portal_transfer type
    staff_name: Optional[str] = None
    is_refund: Optional[bool] = None  # True when this is a "Move to Distributor" reverse transfer
    retailer_ledger_token: Optional[str] = None

    class Config:
        from_attributes = True
