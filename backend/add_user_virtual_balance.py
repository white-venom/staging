import sqlite3
import os

db_files = [f for f in os.listdir('.') if f.endswith('.db')]
if not db_files:
    # Try parent directory or subdirectory
    if os.path.exists("backend"):
        db_files = [os.path.join("backend", f) for f in os.listdir("backend") if f.endswith('.db')]

if not db_files:
    print("No .db file found.")
    exit(1)

db_path = db_files[0]
print(f"Using database: {db_path}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    print("Adding virtual_balance column to users table...")
    cursor.execute("ALTER TABLE users ADD COLUMN virtual_balance DECIMAL(12, 2) DEFAULT 0.00")
    conn.commit()
    print("Column added successfully!")
except sqlite3.OperationalError as e:
    print(f"Operational error (maybe column already exists?): {e}")
except Exception as e:
    print(f"Error: {e}")
finally:
    conn.close()
