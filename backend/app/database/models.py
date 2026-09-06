import uuid
from datetime import datetime, date, timezone
from decimal import Decimal
from typing import List, Optional

def utc_now():
    return datetime.now(timezone.utc)

from sqlalchemy import (
    String,
    Integer,
    Float,
    DateTime,
    ForeignKey,
    Boolean,
    Date,
    Numeric,
    Text,
    UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="staff", nullable=False) # 'admin', 'staff'
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    virtual_balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    token_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    # Custom staff-wise late policy settings (overrides global settings if set)
    late_threshold: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    late_penalty: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    auto_checkout_time: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)

    # Relationships
    attendances: Mapped[List["Attendance"]] = relationship("Attendance", back_populates="user")
    collections: Mapped[List["Collection"]] = relationship("Collection", foreign_keys="[Collection.staff_id]", back_populates="staff")
    bank_deposits: Mapped[List["BankDeposit"]] = relationship(
        "BankDeposit", foreign_keys="[BankDeposit.staff_id]", back_populates="staff"
    )
    received_handovers: Mapped[List["BankDeposit"]] = relationship(
        "BankDeposit", foreign_keys="[BankDeposit.recipient_staff_id]", back_populates="recipient_staff"
    )
    verified_deposits: Mapped[List["BankDeposit"]] = relationship(
        "BankDeposit", foreign_keys="[BankDeposit.verified_by]", back_populates="verifier"
    )


class Retailer(Base):
    __tablename__ = "retailers"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    retailer_name: Mapped[str] = mapped_column(String(150), index=True, nullable=False)
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    assigned_staff_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    ledger_token: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False, default=lambda: uuid.uuid4().hex)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # Financial state
    opening_to_give: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    opening_to_take: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    # The date the opening figures above were actually entered/last adjusted —
    # NOT when the retailer record itself was created. The "Opening Balance"
    # ledger entry is dated off this instead of created_at.
    opening_balance_set_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    # Relationships
    staff: Mapped[Optional[User]] = relationship("User", foreign_keys=[assigned_staff_id])
    stores: Mapped[List["Store"]] = relationship("Store", back_populates="retailer", cascade="all, delete-orphan")
    ledgers: Mapped[List["Ledger"]] = relationship("Ledger", back_populates="retailer", cascade="all, delete-orphan")
    collections: Mapped[List["Collection"]] = relationship("Collection", back_populates="retailer")
    deposits: Mapped[List["BankDeposit"]] = relationship("BankDeposit", back_populates="retailer")


class Portal(Base):
    __tablename__ = "portals"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    opening_to_give: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    opening_to_take: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    # Relationships
    bank_accounts: Mapped[List["BankAccount"]] = relationship("BankAccount", back_populates="portal", cascade="all, delete-orphan")


class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    portal_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("portals.id", ondelete="CASCADE"), nullable=False)
    bank_account_name: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    bank_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    bank_account_no: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    ifsc_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    show_in_online_payment: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    # Financial state for this individual bank account
    opening_to_give: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    opening_to_take: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)

    # Relationships
    portal: Mapped[Portal] = relationship("Portal", back_populates="bank_accounts")
    deposits: Mapped[List["BankDeposit"]] = relationship("BankDeposit", foreign_keys="[BankDeposit.bank_account_id]", back_populates="bank_account")

    @property
    def portal_name(self) -> Optional[str]:
        return self.portal.name if self.portal else None


class PortalAdjustment(Base):
    __tablename__ = "portal_adjustments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    portal_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("portals.id", ondelete="CASCADE"), nullable=False)
    transaction_type: Mapped[str] = mapped_column(String(10), nullable=False)  # 'credit', 'debit'
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    # Relationships
    portal: Mapped[Portal] = relationship("Portal")
    created_by_user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by])


class Store(Base):
    __tablename__ = "stores"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    retailer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("retailers.id", ondelete="CASCADE"), nullable=False)
    store_name: Mapped[str] = mapped_column(String(150), index=True, nullable=False)
    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    # Relationships
    retailer: Mapped[Retailer] = relationship("Retailer", back_populates="stores")
    collections: Mapped[List["Collection"]] = relationship("Collection", back_populates="store")


class Attendance(Base):
    __tablename__ = "attendance"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    start_km: Mapped[int] = mapped_column(Integer, nullable=False)
    end_km: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)  # 'active', 'completed'
    
    # Meter Image & GPS Tracking fields
    start_km_image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    end_km_image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    start_latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    start_longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    end_latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    end_longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Late Penalty fields
    is_late: Mapped[bool] = mapped_column(Boolean, default=False)
    penalty_amount: Mapped[float] = mapped_column(Float, default=0.0)
    is_penalty_approved: Mapped[bool] = mapped_column(Boolean, default=False) # Admin must approve

    # Relationships
    user: Mapped[User] = relationship("User", back_populates="attendances")


class BusinessSettings(Base):
    """Global settings for the business (e.g., late arrival threshold, entry edit/delete windows)."""
    __tablename__ = "business_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    late_threshold: Mapped[str] = mapped_column(String(10), default="10:00") # HH:MM format
    late_penalty: Mapped[float] = mapped_column(Float, default=100.0)
    auto_checkout_time: Mapped[str] = mapped_column(String(10), default="20:00", server_default="20:00")
    # Staff entry edit/delete window in minutes. -1 = permanent (no time restriction).
    edit_window_minutes: Mapped[int] = mapped_column(Integer, default=5, server_default="5")
    delete_window_minutes: Mapped[int] = mapped_column(Integer, default=5, server_default="5")
    opening_cash_in_hand: Mapped[float] = mapped_column(Float, default=0.0, server_default="0.0")
    staff_can_change_collection_date: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)



class Collection(Base):
    __tablename__ = "collections"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    retailer_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("retailers.id", ondelete="CASCADE"), nullable=True)
    staff_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    from_staff_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    from_office: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    store_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("stores.id", ondelete="SET NULL"), nullable=True)
    bank_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("bank_accounts.id", ondelete="SET NULL"), nullable=True)
    # For a staff-to-staff handover, points at the auto-created BankDeposit that
    # mirrors this collection on the sender's (from_staff_id's) side. A real FK
    # instead of matching by staff_id/amount/date coincidence, so create/update/
    # delete can always find the correct paired record with no ambiguity.
    mirror_deposit_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("bank_deposits.id", ondelete="SET NULL"), nullable=True)
    # For a retailer collection with an online component routed to a bank_account,
    # points at the auto-created BankDeposit (deposit_type='portal',
    # payment_mode='online') that carries that online_amount into the bank_account's
    # balance. A real FK instead of matching by bank_account_id/staff_id/amount/date
    # coincidence -- without it, editing that deposit directly leaves this Collection
    # silently stale, and deleting this Collection can fail to find (and therefore
    # fail to reverse the balance of) the deposit if it was ever edited independently.
    online_routing_deposit_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("bank_deposits.id", ondelete="SET NULL"), nullable=True)

    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    collection_date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="verified", nullable=False) # 'pending', 'verified'
    balance_snapshot: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0.00, nullable=False) # Snapshot of retailer balance after transaction
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    # Relationships
    retailer: Mapped[Optional[Retailer]] = relationship("Retailer", back_populates="collections")
    staff: Mapped[User] = relationship("User", foreign_keys=[staff_id], back_populates="collections")
    from_staff: Mapped[Optional[User]] = relationship("User", foreign_keys=[from_staff_id])
    store: Mapped[Optional[Store]] = relationship("Store", back_populates="collections")
    bank_account: Mapped[Optional[BankAccount]] = relationship("BankAccount")
    denominations: Mapped["Denomination"] = relationship(
        "Denomination", back_populates="collection", uselist=False, cascade="all, delete-orphan"
    )
    ledgers: Mapped[List["Ledger"]] = relationship("Ledger", back_populates="collection")


class Denomination(Base):
    __tablename__ = "denominations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    collection_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("collections.id", ondelete="CASCADE"), nullable=True)
    deposit_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("bank_deposits.id", ondelete="CASCADE"), nullable=True)
    
    # Note count fields
    note_500: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    note_200: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    note_100: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    note_50: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    note_20: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    note_10: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    coins: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0.00, nullable=False)
    
    # Online breakdown supporting cashless entries
    online_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)

    # Relationships
    collection: Mapped[Optional[Collection]] = relationship("Collection", back_populates="denominations")
    deposit: Mapped[Optional["BankDeposit"]] = relationship("BankDeposit", back_populates="denominations")


class DenominationBaseline(Base):
    """A verified snapshot of a staff's physical cash-in-hand at a point in time.
    Pocket denomination calculations start from the most recent baseline (if any)
    instead of replaying a staff's entire transaction history, so historical data
    gaps (un-itemized legacy entries, note exchanges) can't drift the running count.
    """
    __tablename__ = "denomination_baselines"
    __table_args__ = (
        UniqueConstraint("staff_id", "as_of", name="uq_denomination_baseline_staff_as_of"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    staff_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    note_500: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    note_200: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    note_100: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    note_50: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    note_20: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    note_10: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    coins: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0.00, nullable=False)

    # Only collections/deposits at or after this instant count on top of this baseline
    as_of: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    set_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    staff: Mapped["User"] = relationship("User", foreign_keys=[staff_id])
    setter: Mapped[Optional["User"]] = relationship("User", foreign_keys=[set_by])


class BankDeposit(Base):
    """Deposits & Payouts tracking staff cash handovers to Portals, Retailers, other Staff, or Office."""
    __tablename__ = "bank_deposits"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    staff_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # deposit_type: 'portal', 'retailer', 'staff', 'virtual', 'portal_transfer'
    deposit_type: Mapped[str] = mapped_column(String(20), nullable=False)
    
    bank_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("bank_accounts.id", ondelete="SET NULL"), nullable=True)
    from_bank_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("bank_accounts.id", ondelete="SET NULL"), nullable=True)  # Source account for portal_transfer type
    retailer_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("retailers.id", ondelete="SET NULL"), nullable=True)
    recipient_staff_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    to_office: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # True if cash was handed directly to main office
    payment_mode: Mapped[str] = mapped_column(String(20), default="cash", nullable=False)  # 'cash', 'online'
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    deposit_date: Mapped[date] = mapped_column(Date, nullable=False)
    
    reference_no: Mapped[Optional[str]] = mapped_column(String(100), unique=True, nullable=True)  # Nullable for direct handovers
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)  # 'pending', 'verified'
    balance_snapshot: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0.00, nullable=False) # Snapshot of account balance after transaction
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    verified_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    staff: Mapped[User] = relationship("User", foreign_keys=[staff_id], back_populates="bank_deposits")
    recipient_staff: Mapped[Optional[User]] = relationship("User", foreign_keys=[recipient_staff_id], back_populates="received_handovers")
    verifier: Mapped[Optional[User]] = relationship("User", foreign_keys=[verified_by], back_populates="verified_deposits")
    bank_account: Mapped[Optional[BankAccount]] = relationship("BankAccount", foreign_keys=[bank_account_id], back_populates="deposits")
    from_bank_account: Mapped[Optional[BankAccount]] = relationship("BankAccount", foreign_keys=[from_bank_account_id])
    retailer: Mapped[Optional[Retailer]] = relationship("Retailer", back_populates="deposits")
    denominations: Mapped[Optional[Denomination]] = relationship(
        "Denomination", back_populates="deposit", uselist=False, cascade="all, delete-orphan"
    )
    ledgers: Mapped[List["Ledger"]] = relationship("Ledger", back_populates="deposit")


class Ledger(Base):
    __tablename__ = "ledgers"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    retailer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("retailers.id", ondelete="CASCADE"), nullable=False)
    transaction_type: Mapped[str] = mapped_column(String(10), nullable=False)  # 'credit', 'debit'
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)  # Running outstanding balance
    
    # High fidelity bookkeeping: e.g., 'given topup', 'cash collection', 'payout refund'
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    collection_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("collections.id", ondelete="SET NULL"), nullable=True
    )
    deposit_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("bank_deposits.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    # Relationships
    retailer: Mapped[Retailer] = relationship("Retailer", back_populates="ledgers")
    collection: Mapped[Optional[Collection]] = relationship("Collection", back_populates="ledgers")
    deposit: Mapped[Optional[BankDeposit]] = relationship("BankDeposit", back_populates="ledgers")
