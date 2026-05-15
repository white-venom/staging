import sqlite3
import os

db_path = "doit_services.db" # Standard name, let me check main.py for actual name if needed
# Actually, I'll check the current directory for .db files
db_files = [f for f in os.listdir('.') if f.endswith('.db')]
if not db_files:
    print("No .db file found in current directory.")
    exit(1)

db_path = db_files[0]
print(f"Using database: {db_path}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    print("Adding columns to portals table...")
    cursor.execute("ALTER TABLE portals ADD COLUMN opening_to_give DECIMAL(12, 2) DEFAULT 0.00")
    cursor.execute("ALTER TABLE portals ADD COLUMN opening_to_take DECIMAL(12, 2) DEFAULT 0.00")
    cursor.execute("ALTER TABLE portals ADD COLUMN balance DECIMAL(12, 2) DEFAULT 0.00")
    conn.commit()
    print("Columns added successfully!")
except sqlite3.OperationalError as e:
    print(f"Operational error (maybe columns already exist?): {e}")
except Exception as e:
    print(f"Error: {e}")
finally:
    conn.close()
