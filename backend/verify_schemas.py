import sys
from decimal import Decimal
from datetime import datetime, date
import uuid
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

# Set up module path resolution
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database.db import Base
from app.database.models import User, Portal, Retailer, Attendance, Collection, Denomination, BankDeposit, Ledger


def run_schema_verification():
    print("🚀 Initializing In-Memory SQLite database for New Schema Verification...")
    
    # 1. Use an in-memory SQLite database for validation
    engine = create_engine("sqlite:///:memory:", echo=False)
    SessionClass = sessionmaker(bind=engine)
    session = SessionClass()

    # 2. Build tables
    print("🛠  Generating database tables from newly updated SQLAlchemy models...")
    Base.metadata.create_all(engine)
    print("✅ Tables generated successfully!")

    # 3. Insert and verify mock entities
    print("\n📝 Inserting mock relational data matching screenshots & WhatsApp notes...")
    try:
        # Create a mock Admin and two Staff members
        admin = User(name="Owner Admin", phone="9999999999", role="admin", password_hash="dummy_argon2_hash")
        staff_1 = User(name="Collection Staff A", phone="8888888888", role="staff", password_hash="dummy_argon2_hash")
        staff_2 = User(name="Collection Staff B", phone="7777777777", role="staff", password_hash="dummy_argon2_hash")
        session.add_all([admin, staff_1, staff_2])
        session.commit()
        print(f"   ↳ Created Users: Admin (ID: {admin.id}), Staff A (ID: {staff_1.id}), Staff B (ID: {staff_2.id})")

        # Create a mock Portal/Store (Muthoot / Blinkit)
        portal = Portal(
            portal_name="Blinkit Store Sector 5",
            bank_name="HDFC Bank",
            bank_account_no="50100412345678",
            ifsc_code="HDFC0000123"
        )
        session.add(portal)
        session.commit()
        print(f"   ↳ Created Portal/Store: {portal.portal_name}")

        # Create a mock Retailer assigned to Staff A
        retailer = Retailer(
            retailer_name="Aggarwal Kirana Store",
            address="Sector 15, Dwarka",
            assigned_staff_id=staff_1.id,
            email="aggarwal.store@gmail.com",
            phone="9876543210"
        )
        session.add(retailer)
        session.commit()
        print(f"   ↳ Created Retailer: {retailer.retailer_name} assigned to Staff A")

        # Log Attendance
        attendance = Attendance(user_id=staff_1.id, start_km=12540, status="active")
        session.add(attendance)
        session.commit()

        # Create a Collection associated with a Retailer & Portal/Store
        collection = Collection(
            retailer_id=retailer.id,
            staff_id=staff_1.id,
            portal_id=portal.id,
            total_amount=Decimal("15200.00"),
            remarks="Full cash collection and online scan",
            status="pending"
        )
        session.add(collection)
        session.commit()
        
        # Denomination breakdown including CASH + ONLINE mix!
        denom = Denomination(
            collection_id=collection.id,
            note_500=20,          # 10,000 cash
            note_200=10,          # 2,000 cash
            note_100=12,          # 1,200 cash
            online_amount=Decimal("2000.00") # 2,000 online UPI scan (Matches total amount = 15,200!)
        )
        session.add(denom)
        session.commit()

        # Create a Ledger Entry for retailer balance tracking with custom descriptions
        ledger_credit = Ledger(
            retailer_id=retailer.id,
            transaction_type="credit",
            amount=collection.total_amount,
            balance=Decimal("0.00"),  # Out of outstanding debt
            description="cash collection",
            collection_id=collection.id
        )
        ledger_debit = Ledger(
            retailer_id=retailer.id,
            transaction_type="debit",
            amount=Decimal("5000.00"),
            balance=Decimal("5000.00"),
            description="given topup" # Satisfies WhatsApp requirement: "given topup"
        )
        session.add_all([ledger_credit, ledger_debit])
        session.commit()
        print("   ↳ Ledger Entries Created:")
        print(f"     ↳ Credit: ₹{ledger_credit.amount} ({ledger_credit.description})")
        print(f"     ↳ Debit: ₹{ledger_debit.amount} ({ledger_debit.description}) ➜ New Balance: ₹{ledger_debit.balance}")

        # [Option A] Create a Portal Deposit
        deposit_portal = BankDeposit(
            staff_id=staff_1.id,
            deposit_type="portal",
            portal_id=portal.id,
            payment_mode="cash",
            amount=Decimal("10000.00"),
            deposit_date=date.today(),
            reference_no="TXN_PORTAL_999",
            status="pending"
        )
        session.add(deposit_portal)
        session.commit()
        print(f"   ↳ [Option A] Logged Portal Deposit Record: Amount ₹{deposit_portal.amount} to Portal")

        # [Option B] Create a Retailer Refund / Payout
        deposit_retailer = BankDeposit(
            staff_id=staff_1.id,
            deposit_type="retailer",
            retailer_id=retailer.id,
            payment_mode="online",
            amount=Decimal("2000.00"),
            deposit_date=date.today(),
            reference_no="TXN_RETAILER_UPI_111",
            status="pending"
        )
        session.add(deposit_retailer)
        session.commit()
        print(f"   ↳ [Option B] Logged Retailer Payout Record: Amount ₹{deposit_retailer.amount} back to Retailer")

        # [Option C] Create a Handover to Staff (Staff A turns over cash to Staff B!)
        deposit_staff = BankDeposit(
            staff_id=staff_1.id,
            deposit_type="staff",
            recipient_staff_id=staff_2.id,
            payment_mode="cash",
            amount=Decimal("3200.00"),
            deposit_date=date.today(),
            status="pending"
        )
        session.add(deposit_staff)
        session.commit()
        print(f"   ↳ [Option C] Logged Staff Handover: Staff A handed over ₹{deposit_staff.amount} to Recipient: {staff_2.name}")

        # Check cascading deletions (if collection is deleted, denomination should vanish)
        print("\n🗑️  Testing Cascading Deletes (Collection ➜ Denomination relationship)...")
        session.delete(collection)
        session.commit()

        # Query denominations to verify CASCADE
        remaining_denoms = session.scalars(select(Denomination).where(Denomination.collection_id == collection.id)).all()
        if len(remaining_denoms) == 0:
            print("✅ Cascade Delete verified! Denomination was successfully purged when Collection was deleted.")
        else:
            print("❌ Cascade Delete failed. Denominations are still lingering in the database.")
            sys.exit(1)

        print("\n🎉 SCHEMA INTEGRITY VERIFICATION COMPLETED SUCCESSFULLY! ALL NEW OPTIONS INCORPORATED.")

    except Exception as e:
        print(f"\n❌ Error during schema verification: {e}")
        session.rollback()
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    run_schema_verification()
