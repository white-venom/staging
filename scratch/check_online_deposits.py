import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database.db import MasterSessionLocal, get_tenant_session
from app.database.master_models import Tenant
from app.database.models import BankDeposit, User, Portal, Retailer

master_db = MasterSessionLocal()
tenants = master_db.query(Tenant).filter(Tenant.status == "active").all()

for tenant in tenants:
    print(f"Scanning tenant: {tenant.subdomain} (DB: {tenant.db_name})...")
    db = None
    try:
        db = get_tenant_session(tenant.subdomain)
        deposits = db.query(BankDeposit).filter(BankDeposit.deposit_type == "portal", BankDeposit.payment_mode == "online").order_by(BankDeposit.created_at.desc()).limit(5).all()
        for dep in deposits:
            portal = db.query(Portal).filter(Portal.id == dep.portal_id).first() if dep.portal_id else None
            retailer = db.query(Retailer).filter(Retailer.id == dep.retailer_id).first() if dep.retailer_id else None
            print(f"  Deposit ID: {dep.id}")
            print(f"  Amount: ₹{dep.amount}")
            print(f"  Portal Name: {portal.portal_name if portal else 'N/A'}")
            print(f"  Retailer Name: {retailer.retailer_name if retailer else 'N/A'}")
            print(f"  Remarks: {dep.remarks}")
            print(f"  Deposit Date: {dep.deposit_date}")
            print(f"  Created At: {dep.created_at}")
            print("-" * 20)
    except Exception as e:
        print(f"  Error: {e}")
    finally:
        if db:
            db.close()

master_db.close()
