import sqlite3
import os

db_path = "doit_services.db" 

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("Checking for missing columns...")
    
    # Check collections table
    cursor.execute("PRAGMA table_info(collections)")
    columns = [col[1] for col in cursor.fetchall()]
    if "balance_snapshot" not in columns:
        print("Adding balance_snapshot to collections...")
        cursor.execute("ALTER TABLE collections ADD COLUMN balance_snapshot NUMERIC(12, 2) DEFAULT 0.00")
    
    # Check bank_deposits table
    cursor.execute("PRAGMA table_info(bank_deposits)")
    columns = [col[1] for col in cursor.fetchall()]
    if "balance_snapshot" not in columns:
        print("Adding balance_snapshot to bank_deposits...")
        cursor.execute("ALTER TABLE bank_deposits ADD COLUMN balance_snapshot NUMERIC(12, 2) DEFAULT 0.00")
        
    conn.commit()
    conn.close()
    print("Migration complete.")
else:
    print(f"Database not found at {db_path}")
