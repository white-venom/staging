import sqlite3
import os

def find_and_fix():
    # Find all .db files
    db_files = [f for f in os.listdir('.') if f.endswith('.db')]
    print(f"Found databases: {db_files}")
    
    for db_path in db_files:
        print(f"\nChecking {db_path}...")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # List tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [t[0] for t in cursor.fetchall()]
        print(f"Tables: {tables}")
        
        if 'portals' in tables:
            print(f"Found 'portals' table in {db_path}. Attempting to add columns...")
            try:
                cursor.execute("ALTER TABLE portals ADD COLUMN opening_to_give DECIMAL(12, 2) DEFAULT 0.00")
                cursor.execute("ALTER TABLE portals ADD COLUMN opening_to_take DECIMAL(12, 2) DEFAULT 0.00")
                cursor.execute("ALTER TABLE portals ADD COLUMN balance DECIMAL(12, 2) DEFAULT 0.00")
                conn.commit()
                print("Columns added successfully!")
            except sqlite3.OperationalError as e:
                print(f"Columns might already exist: {e}")
        else:
            print(f"'portals' table not found in {db_path}.")
        
        conn.close()

if __name__ == "__main__":
    find_and_fix()
