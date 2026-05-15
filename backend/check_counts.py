import sqlite3
import os

db_path = "doit_services.db"
if not os.path.exists(db_path):
    print(f"Database {db_path} not found!")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    tables = ["users", "retailers", "portals", "collections", "bank_deposits", "ledger"]
    for table in tables:
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            print(f"{table}: {count}")
        except Exception as e:
            print(f"{table}: Error - {e}")
    
    conn.close()
