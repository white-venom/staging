import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import settings
from app.database.db import master_engine, MasterSessionLocal, get_tenant_connection_string
from app.database.master_models import Tenant
from app.database.models import Retailer
from app.logic.ledger import recalculate_balances
from scripts.seed_hello import RETAILERS_TO_SEED

def sync_tenants():
    print("🚀 Syncing updated Khatabook opening balances to tenants...")
    master_db = MasterSessionLocal()
    try:
        tenants = master_db.query(Tenant).filter(Tenant.status == "active").all()
        print(f"Found {len(tenants)} active tenant(s).")
        
        for tenant in tenants:
            print(f"\n--- Syncing Tenant: {tenant.name} ({tenant.subdomain}) DB: {tenant.db_name} ---")
            tenant_url = get_tenant_connection_string(tenant.db_name)
            tenant_engine = create_engine(tenant_url)
            TenantSession = sessionmaker(bind=tenant_engine)
            tenant_db = TenantSession()
            try:
                # Build map of existing retailers by normalized name
                existing_rets = tenant_db.query(Retailer).all()
                existing_by_name = {r.retailer_name.strip().lower(): r for r in existing_rets}
                existing_by_phone = {r.phone.strip(): r for r in existing_rets if r.phone}

                updated_count = 0
                created_count = 0

                for r_data in RETAILERS_TO_SEED:
                    r_name = r_data["name"].strip()
                    r_key = r_name.lower()
                    r_phone = r_data["phone"].strip()
                    
                    target = existing_by_name.get(r_key) or existing_by_phone.get(r_phone)
                    
                    if target:
                        # Update opening balances
                        target.opening_to_take = r_data["take"]
                        target.opening_to_give = r_data["give"]
                        target.is_active = True
                        updated_count += 1
                    else:
                        # Create new retailer
                        new_r = Retailer(
                            retailer_name=r_name,
                            phone=r_phone,
                            address="New Delhi",
                            opening_to_take=r_data["take"],
                            opening_to_give=r_data["give"],
                            balance=0.0,
                            is_active=True
                        )
                        tenant_db.add(new_r)
                        created_count += 1

                tenant_db.commit()
                print(f"Updated {updated_count} existing retailers, Created {created_count} new retailers.")

                # Recalculate balances for all retailers
                all_active = tenant_db.query(Retailer).filter(Retailer.is_active == True).all()
                for r in all_active:
                    recalculate_balances(r.id, tenant_db)
                tenant_db.commit()
                print(f"Recalculated running balances for {len(all_active)} retailers.")
            except Exception as e:
                print(f"Error syncing tenant {tenant.subdomain}: {e}")
                tenant_db.rollback()
            finally:
                tenant_db.close()
    finally:
        master_db.close()
    print("\n✅ All tenants synced successfully with Khatabook report data!")

if __name__ == "__main__":
    sync_tenants()
