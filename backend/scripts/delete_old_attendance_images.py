import os
import sys
from datetime import date, timedelta
from sqlalchemy import select, or_

# Set up module path resolution
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database.db import MasterSessionLocal, get_tenant_session
from app.database.master_models import Tenant
from app.database.models import Attendance
from app.logic.r2 import is_r2_configured, delete_image_from_r2

def run_image_cleanup():
    print("[INFO] Starting 2-month Odometer image cleanup process...")
    master_db = MasterSessionLocal()
    try:
        active_tenants = master_db.query(Tenant).filter(Tenant.status == "active").all()
    except Exception as e:
        print(f"[ERROR] Failed to query active tenants: {str(e)}")
        master_db.close()
        return

    static_base_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app")
    r2_active = is_r2_configured()

    for tenant in active_tenants:
        print(f"[INFO] Running image cleanup for tenant '{tenant.subdomain}'...")
        db = None
        try:
            db = get_tenant_session(tenant.subdomain)
            two_months_ago = date.today() - timedelta(days=60)
            stmt = select(Attendance).where(
                or_(
                    Attendance.start_km_image_url != None,
                    Attendance.end_km_image_url != None
                ),
                Attendance.date < two_months_ago
            )
            records = db.scalars(stmt).all()
            if not records:
                print(f"[INFO] No images needed deletion for tenant '{tenant.subdomain}'.")
                continue

            print(f"[INFO] Found {len(records)} attendance records older than 60 days with images for tenant '{tenant.subdomain}'.")
            deleted_count = 0
            
            for r in records:
                # Clean check-in image
                if r.start_km_image_url:
                    if r.start_km_image_url.startswith("http"):
                        if r2_active:
                            delete_image_from_r2(r.start_km_image_url)
                    else:
                        # Relative URL looks like /static/attendance/filename.jpg
                        rel_path = r.start_km_image_url.lstrip("/")
                        filepath = os.path.join(static_base_dir, rel_path)
                        if os.path.exists(filepath):
                            try:
                                os.remove(filepath)
                                print(f"[INFO] Deleted check-in image locally: {filepath}")
                            except Exception as e:
                                print(f"[WARNING] Error deleting local file {filepath}: {str(e)}")
                    r.start_km_image_url = None
                    deleted_count += 1
                    
                # Clean check-out image
                if r.end_km_image_url:
                    if r.end_km_image_url.startswith("http"):
                        if r2_active:
                            delete_image_from_r2(r.end_km_image_url)
                    else:
                        # Relative URL
                        rel_path = r.end_km_image_url.lstrip("/")
                        filepath = os.path.join(static_base_dir, rel_path)
                        if os.path.exists(filepath):
                            try:
                                os.remove(filepath)
                                print(f"[INFO] Deleted check-out image locally: {filepath}")
                            except Exception as e:
                                print(f"[WARNING] Error deleting local file {filepath}: {str(e)}")
                    r.end_km_image_url = None
                    deleted_count += 1
                    
            if deleted_count > 0:
                db.commit()
                print(f"[INFO] Successfully cleaned up {deleted_count} image references and updated database for tenant '{tenant.subdomain}'.")
        except Exception as e:
            print(f"[ERROR] Error during image cleanup for tenant '{tenant.subdomain}': {str(e)}")
            if db:
                db.rollback()
        finally:
            if db:
                db.close()
                
    master_db.close()

if __name__ == "__main__":
    run_image_cleanup()

