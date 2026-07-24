import os
import sys

# Ensure backend directory is in sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database.db import MasterSessionLocal
from app.database.master_models import SuperAdmin
from app.core.security import get_password_hash

def main():
    username = sys.argv[1] if len(sys.argv) > 1 else "superadmin"
    new_password = sys.argv[2] if len(sys.argv) > 2 else "superpass123"

    session = MasterSessionLocal()
    try:
        admin = session.query(SuperAdmin).filter(SuperAdmin.username == username).first()
        if not admin:
            print(f"Error: SuperAdmin with username '{username}' not found.")
            sys.exit(1)

        admin.password_hash = get_password_hash(new_password)
        session.commit()
        print(f"Success: Password for superadmin '{username}' has been updated.")
    finally:
        session.close()

if __name__ == "__main__":
    main()
