import os
import sys

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlalchemy import create_engine, text
from app.database.db import get_tenant_connection_string

def dump_portals():
    db_name = "crediiflow_do_it_services"
    print(f"🔍 Dumping Portals and Groups from '{db_name}'...")
    try:
        url = get_tenant_connection_string(db_name)
        engine = create_engine(url)
        with engine.connect() as conn:
            # Groups
            print("\n--- PORTAL GROUPS ---")
            groups = conn.execute(text("SELECT id, name FROM portal_groups")).fetchall()
            for g in groups:
                print(f"Group ID: {g[0]} | Name: {g[1]}")
                
            # Portals
            print("\n--- PORTALS ---")
            portals = conn.execute(text("SELECT id, group_id, portal_name, bank_name, bank_account_no FROM portals")).fetchall()
            for p in portals:
                print(f"Portal ID: {p[0]} | Group ID: {p[1]} | Portal Name: {p[2]} | Bank Name: {p[3]} | Account No: {p[4]}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    dump_portals()
