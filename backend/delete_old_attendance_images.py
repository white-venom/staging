import os
import sys
from datetime import date, timedelta
from sqlalchemy import select, or_

# Set up module path resolution
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database.db import SessionLocal
from app.database.models import Attendance

def run_image_cleanup():
    print("[INFO] Starting 2-month Odometer image cleanup process...")
    db = SessionLocal()
    try:
        two_months_ago = date.today() - timedelta(days=60)
        stmt = select(Attendance).where(
            or_(
                Attendance.start_km_image_url != None,
                Attendance.end_km_image_url != None
            ),
            Attendance.date < two_months_ago
        )
        records = db.scalars(stmt).all()
        print(f"[INFO] Found {len(records)} attendance records older than 60 days with images.")
        
        static_base_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app")
        
        deleted_count = 0
        for r in records:
            # Clean check-in image
            if r.start_km_image_url:
                # Relative URL looks like /static/attendance/filename.jpg
                rel_path = r.start_km_image_url.lstrip("/")
                filepath = os.path.join(static_base_dir, rel_path)
                if os.path.exists(filepath):
                    try:
                        os.remove(filepath)
                        print(f"[INFO] Deleted check-in image: {filepath}")
                    except Exception as e:
                        print(f"[WARNING] Error deleting file {filepath}: {str(e)}")
                r.start_km_image_url = None
                deleted_count += 1
                
            # Clean check-out image
            if r.end_km_image_url:
                rel_path = r.end_km_image_url.lstrip("/")
                filepath = os.path.join(static_base_dir, rel_path)
                if os.path.exists(filepath):
                    try:
                        os.remove(filepath)
                        print(f"[INFO] Deleted check-out image: {filepath}")
                    except Exception as e:
                        print(f"[WARNING] Error deleting file {filepath}: {str(e)}")
                r.end_km_image_url = None
                deleted_count += 1
                
        if deleted_count > 0:
            db.commit()
            print(f"[INFO] Successfully cleaned up {deleted_count} physical images and updated database references.")
        else:
            print("[INFO] No images needed deletion.")
    except Exception as e:
        print(f"[ERROR] Error during image cleanup: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    run_image_cleanup()
