import sqlite3
import os

db_path = "backend/doit_services.db"

def migrate():
    if not os.path.exists(db_path):
        print("Database not found.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        print("Adding columns to portal_groups table...")
        cursor.execute("ALTER TABLE portal_groups ADD COLUMN opening_to_give FLOAT DEFAULT 0.0")
        cursor.execute("ALTER TABLE portal_groups ADD COLUMN opening_to_take FLOAT DEFAULT 0.0")
        cursor.execute("ALTER TABLE portal_groups ADD COLUMN balance FLOAT DEFAULT 0.0")
        conn.commit()
        print("Migration successful!")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("Columns already exist.")
        else:
            print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
