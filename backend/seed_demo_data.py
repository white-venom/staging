"""
Demo Seed Script
================
Seeds the following data into the 'do-it-services' tenant:
  - 2 Staff users
  - 1 Admin user
  - 2 Retailers
  - 2 Portal Groups, each with 2 bank portals

Usage:
    .\\venv\\Scripts\\activate.ps1
    python seed_demo_data.py
"""
import sys
import os
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Tell the db module which tenant to connect to
os.environ["TEST_TENANT_ID"] = "do-it-services"

from sqlalchemy import select
from app.database.db import get_tenant_session
from app.database.models import User, Retailer, PortalGroup, Portal
from app.core.security import get_password_hash


def seed():
    db = get_tenant_session("do-it-services")
    try:
        print("\n========== SEEDING DEMO DATA (tenant: do-it-services) ==========\n")

        # ── STAFF USERS ──────────────────────────────────────────────────────
        staff_data = [
            {"name": "Rahul Sharma",  "phone": "9910000001", "role": "staff"},
            {"name": "Priya Verma",   "phone": "9910000002", "role": "staff"},
        ]

        created_staff = []
        for s in staff_data:
            existing = db.scalar(select(User).where(User.phone == s["phone"]))
            if existing:
                print(f"  [SKIP]   Staff already exists: {s['name']} ({s['phone']})")
                existing.password_hash = get_password_hash("pass123")
                created_staff.append(existing)
            else:
                user = User(
                    id=uuid.uuid4(),
                    name=s["name"],
                    phone=s["phone"],
                    password_hash=get_password_hash("pass123"),
                    role="staff",
                    is_active=True,
                )
                db.add(user)
                db.flush()
                created_staff.append(user)
                print(f"  [CREATE] Staff: {s['name']} | Phone: {s['phone']} | Pass: pass123")

        # ── ADMIN USER ────────────────────────────────────────────────────────
        admin_phone = "9900000010"
        existing_admin = db.scalar(select(User).where(User.phone == admin_phone))
        if existing_admin:
            print(f"  [SKIP]   Admin already exists: {existing_admin.name} ({admin_phone})")
            existing_admin.password_hash = get_password_hash("admin123")
        else:
            admin = User(
                id=uuid.uuid4(),
                name="Anil Kumar",
                phone=admin_phone,
                password_hash=get_password_hash("admin123"),
                role="admin",
                is_active=True,
            )
            db.add(admin)
            print(f"  [CREATE] Admin: Anil Kumar | Phone: {admin_phone} | Pass: admin123")

        db.flush()

        # ── RETAILERS ─────────────────────────────────────────────────────────
        staff_id = created_staff[0].id if created_staff else None

        retailers_data = [
            {
                "retailer_name": "Aggarwal Kirana Store",
                "phone": "9876543210",
                "address": "Sector 15, Rohini, Delhi",
                "opening_to_give": 5000.00,
                "opening_to_take": 0.00,
                "balance": -5000.00,
            },
            {
                "retailer_name": "Sharma General Traders",
                "phone": "9812345678",
                "address": "Dwarka Sector 7, Delhi",
                "opening_to_give": 0.00,
                "opening_to_take": 2500.00,
                "balance": 2500.00,
            },
        ]

        for r in retailers_data:
            existing = db.scalar(select(Retailer).where(Retailer.phone == r["phone"]))
            if existing:
                print(f"  [SKIP]   Retailer already exists: {r['retailer_name']} ({r['phone']})")
            else:
                retailer = Retailer(
                    id=uuid.uuid4(),
                    retailer_name=r["retailer_name"],
                    phone=r["phone"],
                    address=r["address"],
                    assigned_staff_id=staff_id,
                    opening_to_give=r["opening_to_give"],
                    opening_to_take=r["opening_to_take"],
                    balance=r["balance"],
                )
                db.add(retailer)
                print(f"  [CREATE] Retailer: {r['retailer_name']} | Phone: {r['phone']}")

        db.flush()

        # ── PORTAL GROUPS (2 groups × 2 banks each) ───────────────────────────
        portal_groups_data = [
            {
                "name": "Blinkit & Online Portals",
                "portals": [
                    {
                        "portal_name": "Blinkit Store Sector 5",
                        "bank_name": "HDFC Bank",
                        "bank_account_no": "50100123456789",
                        "ifsc_code": "HDFC0001234",
                    },
                    {
                        "portal_name": "Blinkit Store Sector 12",
                        "bank_name": "ICICI Bank",
                        "bank_account_no": "000105009876",
                        "ifsc_code": "ICIC0000512",
                    },
                ],
            },
            {
                "name": "Muthoot & Field Cash Portals",
                "portals": [
                    {
                        "portal_name": "Muthoot Office West",
                        "bank_name": "SBI",
                        "bank_account_no": "31234567890",
                        "ifsc_code": "SBIN0001425",
                    },
                    {
                        "portal_name": "Muthoot Office Central",
                        "bank_name": "Punjab National Bank",
                        "bank_account_no": "0425002100015678",
                        "ifsc_code": "PUNB0042500",
                    },
                ],
            },
        ]

        for pg_data in portal_groups_data:
            existing_group = db.scalar(select(PortalGroup).where(PortalGroup.name == pg_data["name"]))
            if existing_group:
                print(f"  [SKIP]   PortalGroup already exists: {pg_data['name']}")
                group = existing_group
            else:
                group = PortalGroup(
                    id=uuid.uuid4(),
                    name=pg_data["name"],
                    opening_to_give=0,
                    opening_to_take=0,
                    balance=0,
                )
                db.add(group)
                db.flush()
                print(f"  [CREATE] PortalGroup: {pg_data['name']}")

            for p_data in pg_data["portals"]:
                existing_portal = db.scalar(
                    select(Portal).where(
                        Portal.group_id == group.id,
                        Portal.portal_name == p_data["portal_name"],
                    )
                )
                if existing_portal:
                    print(f"           [SKIP] Portal already exists: {p_data['portal_name']}")
                else:
                    portal = Portal(
                        id=uuid.uuid4(),
                        group_id=group.id,
                        portal_name=p_data["portal_name"],
                        bank_name=p_data["bank_name"],
                        bank_account_no=p_data["bank_account_no"],
                        ifsc_code=p_data["ifsc_code"],
                        opening_to_give=0,
                        opening_to_take=0,
                        balance=0,
                    )
                    db.add(portal)
                    print(f"           [CREATE] Portal: {p_data['portal_name']} | {p_data['bank_name']}")

        db.commit()

        print("\n========== SEED SUMMARY ==========")
        print("  Staff (2):")
        print("    Phone: 9910000001  Pass: pass123  (Rahul Sharma)")
        print("    Phone: 9910000002  Pass: pass123  (Priya Verma)")
        print("  Admin (1):")
        print("    Phone: 9900000010  Pass: admin123 (Anil Kumar)")
        print("  Retailers (2):")
        print("    Aggarwal Kirana Store  | 9876543210")
        print("    Sharma General Traders | 9812345678")
        print("  Portal Groups (2):")
        print("    'Blinkit & Online Portals'    -> HDFC Bank, ICICI Bank")
        print("    'Muthoot & Field Cash Portals' -> SBI, Punjab National Bank")
        print("\n✅ Seeding completed successfully!\n")

    except Exception as e:
        print(f"\n❌ Error during seeding: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
