from app.database.db import MasterSessionLocal, get_tenant_session
from app.database.master_models import Tenant
from app.database.models import BankDeposit, User, Portal, Retailer

# Scan all active tenants
master_db = MasterSessionLocal()
tenants = master_db.query(Tenant).filter(Tenant.status == "active").all()
print(f"Scanning {len(tenants)} active tenants...")

found = False
for tenant in tenants:
    print(f"Scanning tenant: {tenant.subdomain} (DB: {tenant.db_name})...")
    db = None
    try:
        db = get_tenant_session(tenant.subdomain)
        dep = db.query(BankDeposit).filter(BankDeposit.amount == 1179000).first()
        if dep:
            staff = db.query(User).filter(User.id == dep.staff_id).first()
            portal = db.query(Portal).filter(Portal.id == dep.portal_id).first() if dep.portal_id else None
            retailer = db.query(Retailer).filter(Retailer.id == dep.retailer_id).first() if dep.retailer_id else None
            recipient = db.query(User).filter(User.id == dep.recipient_staff_id).first() if dep.recipient_staff_id else None
            
            print(f"\n==========================================")
            print(f"DEPOSIT FOUND IN TENANT: {tenant.subdomain}")
            print(f"==========================================")
            print(f"  Deposit ID: {dep.id}")
            print(f"  Deposit Type: {dep.deposit_type}")
            print(f"  Amount: ₹{dep.amount}")
            print(f"  Staff: {staff.name if staff else 'N/A'} (ID: {dep.staff_id})")
            print(f"  Portal: {portal.portal_name if portal else 'N/A'} (ID: {dep.portal_id})")
            print(f"  Retailer: {retailer.retailer_name if retailer else 'N/A'} (ID: {dep.retailer_id})")
            print(f"  Recipient Staff: {recipient.name if recipient else 'N/A'} (ID: {dep.recipient_staff_id})")
            print(f"  Remarks: {dep.remarks}")
            print(f"  Target Name: {dep.target_name}")
            print(f"  Created At: {dep.created_at}")
            print(f"  Status: {dep.status}")
            print(f"  Reference No: {dep.reference_no}")
            print(f"==========================================\n")
            found = True
            break
    except Exception as e:
        print(f"  Error scanning tenant {tenant.subdomain}: {e}")
    finally:
        if db:
            db.close()

if not found:
    print("Finished scan: No deposit of amount ₹1,179,000 was found in any active tenant database.")

master_db.close()
