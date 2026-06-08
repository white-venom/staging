import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    String, 
    Integer, 
    Float, 
    DateTime, 
    ForeignKey, 
    Boolean, 
    Date, 
    Numeric, 
    Text
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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

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
    
    # Financial state
    opening_to_give: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    opening_to_take: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    staff: Mapped[Optional[User]] = relationship("User", foreign_keys=[assigned_staff_id])
    stores: Mapped[List["Store"]] = relationship("Store", back_populates="retailer", cascade="all, delete-orphan")
    ledgers: Mapped[List["Ledger"]] = relationship("Ledger", back_populates="retailer", cascade="all, delete-orphan")
    collections: Mapped[List["Collection"]] = relationship("Collection", back_populates="retailer")
    deposits: Mapped[List["BankDeposit"]] = relationship("BankDeposit", back_populates="retailer")


class PortalGroup(Base):
    __tablename__ = "portal_groups"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    opening_to_give: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    opening_to_take: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    portals: Mapped[List["Portal"]] = relationship("Portal", back_populates="group", cascade="all, delete-orphan")


class Portal(Base):
    __tablename__ = "portals"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    group_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("portal_groups.id", ondelete="CASCADE"), nullable=False)
    portal_name: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    bank_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    bank_account_no: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    ifsc_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Financial state for individual portal account
    opening_to_give: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    opening_to_take: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)

    # Relationships
    group: Mapped[PortalGroup] = relationship("PortalGroup", back_populates="portals")
    deposits: Mapped[List["BankDeposit"]] = relationship("BankDeposit", back_populates="portal")


class Store(Base):
    __tablename__ = "stores"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    retailer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("retailers.id", ondelete="CASCADE"), nullable=False)
    store_name: Mapped[str] = mapped_column(String(150), index=True, nullable=False)
    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    retailer: Mapped[Retailer] = relationship("Retailer", back_populates="stores")
    collections: Mapped[List["Collection"]] = relationship("Collection", back_populates="store", cascade="all, delete-orphan")


class Attendance(Base):
    __tablename__ = "attendance"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    start_km: Mapped[int] = mapped_column(Integer, nullable=False)
    end_km: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
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
    """Global settings for the business (e.g., late arrival threshold)."""
    __tablename__ = "business_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    late_threshold: Mapped[str] = mapped_column(String(10), default="10:00") # HH:MM format
    late_penalty: Mapped[float] = mapped_column(Float, default=100.0)
    auto_checkout_time: Mapped[str] = mapped_column(String(10), default="20:00", server_default="20:00")
    
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Collection(Base):
    __tablename__ = "collections"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    retailer_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("retailers.id", ondelete="CASCADE"), nullable=True)
    staff_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    from_staff_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    from_office: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    store_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), nullable=True)
    portal_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("portals.id", ondelete="SET NULL"), nullable=True)
    
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    collection_date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="verified", nullable=False) # 'pending', 'verified'
    balance_snapshot: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0.00, nullable=False) # Snapshot of retailer balance after transaction
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    retailer: Mapped[Optional[Retailer]] = relationship("Retailer", back_populates="collections")
    staff: Mapped[User] = relationship("User", foreign_keys=[staff_id], back_populates="collections")
    from_staff: Mapped[Optional[User]] = relationship("User", foreign_keys=[from_staff_id])
    store: Mapped[Optional[Store]] = relationship("Store", back_populates="collections")
    portal: Mapped[Optional[Portal]] = relationship("Portal")
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


class BankDeposit(Base):
    """Deposits & Payouts tracking staff cash handovers to Portals, Retailers, other Staff, or Office."""
    __tablename__ = "bank_deposits"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    staff_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Triple structure: 'portal' (Option A), 'retailer' (Option B), 'staff' (Option C: handovers to staff or physical office)
    deposit_type: Mapped[str] = mapped_column(String(20), nullable=False)  # 'portal', 'retailer', 'staff'
    
    portal_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("portals.id", ondelete="SET NULL"), nullable=True)
    retailer_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("retailers.id", ondelete="SET NULL"), nullable=True)
    recipient_staff_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    to_office: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # True if cash was handed directly to main office
    payment_mode: Mapped[str] = mapped_column(String(20), default="cash", nullable=False)  # 'cash', 'online'
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    deposit_date: Mapped[date] = mapped_column(Date, nullable=False)
    
    reference_no: Mapped[Optional[str]] = mapped_column(String(100), unique=True, nullable=True)  # Nullable for direct handovers
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)  # 'pending', 'verified'
    balance_snapshot: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0.00, nullable=False) # Snapshot of account balance after transaction
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    verified_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    staff: Mapped[User] = relationship("User", foreign_keys=[staff_id], back_populates="bank_deposits")
    recipient_staff: Mapped[Optional[User]] = relationship("User", foreign_keys=[recipient_staff_id], back_populates="received_handovers")
    verifier: Mapped[Optional[User]] = relationship("User", foreign_keys=[verified_by], back_populates="verified_deposits")
    portal: Mapped[Optional[Portal]] = relationship("Portal", back_populates="deposits")
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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    retailer: Mapped[Retailer] = relationship("Retailer", back_populates="ledgers")
    collection: Mapped[Optional[Collection]] = relationship("Collection", back_populates="ledgers")
    deposit: Mapped[Optional[BankDeposit]] = relationship("BankDeposit", back_populates="ledgers")
