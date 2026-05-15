import sqlite3
import os

db_path = 'doit_services.db'
if not os.path.exists(db_path):
    print(f"Error: {db_path} not found.")
    exit(1)

conn = sqlite3.connect(db_path)
c = conn.cursor()

print("Checking database schema and fixing deletion rules...")

try:
    # 1. Enable Foreign Keys in SQLite
    c.execute('PRAGMA foreign_keys = OFF;') # Turn off to modify tables

    # 2. Check if portal_groups has financial columns
    c.execute("PRAGMA table_info(portal_groups)")
    columns = [col[1] for col in c.fetchall()]
    
    needed_cols = [
        ('opening_to_give', 'NUMERIC(12, 2) DEFAULT 0.00'),
        ('opening_to_take', 'NUMERIC(12, 2) DEFAULT 0.00'),
        ('balance', 'NUMERIC(12, 2) DEFAULT 0.00')
    ]
    
    for col_name, col_type in needed_cols:
        if col_name not in columns:
            print(f"Adding column {col_name} to portal_groups...")
            c.execute(f"ALTER TABLE portal_groups ADD COLUMN {col_name} {col_type}")

    # 3. Re-create portals table with proper CASCADE DELETE if needed
    # In SQLite, to add ON DELETE CASCADE to an existing table, we must recreate it.
    c.execute("PRAGMA table_info(portals)")
    portal_columns_info = c.fetchall()
    portal_columns = [col[1] for col in portal_columns_info]
    
    # Check if we have group_id
    if 'group_id' not in portal_columns:
         print("Error: group_id missing in portals table. Please run the main migration first.")
    else:
        print("Ensuring portals table has CASCADE DELETE for group_id...")
        # Create temp table
        c.execute("DROP TABLE IF EXISTS portals_new")
        c.execute('''
            CREATE TABLE portals_new (
                id CHAR(32) PRIMARY KEY,
                group_id CHAR(32) NOT NULL,
                portal_name VARCHAR(100) NOT NULL,
                bank_name VARCHAR(100),
                bank_account_no VARCHAR(100),
                ifsc_code VARCHAR(20),
                created_at DATETIME NOT NULL,
                FOREIGN KEY (group_id) REFERENCES portal_groups (id) ON DELETE CASCADE
            )
        ''')
        
        # Copy data
        cols_str = "id, group_id, portal_name, bank_name, bank_account_no, ifsc_code, created_at"
        c.execute(f"INSERT INTO portals_new ({cols_str}) SELECT {cols_str} FROM portals")
        
        # Swap tables
        c.execute("DROP TABLE portals")
        c.execute("ALTER TABLE portals_new RENAME TO portals")

    conn.commit()
    print("Database schema fixed successfully!")
    print("Now you can delete portals without 'Failed to fetch' error.")

except Exception as e:
    print(f"Error fixing database: {e}")
    conn.rollback()
finally:
    conn.close()
