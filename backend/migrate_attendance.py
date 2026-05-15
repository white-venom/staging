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
        print("Adding columns to attendance table...")
        cursor.execute("ALTER TABLE attendance ADD COLUMN is_late BOOLEAN DEFAULT 0")
        cursor.execute("ALTER TABLE attendance ADD COLUMN penalty_amount FLOAT DEFAULT 0.0")
        cursor.execute("ALTER TABLE attendance ADD COLUMN is_penalty_approved BOOLEAN DEFAULT 0")
        
        print("Creating business_settings table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS business_settings (
                id INTEGER PRIMARY KEY,
                late_threshold TEXT DEFAULT '10:00',
                late_penalty FLOAT DEFAULT 100.0,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Seed default settings if not exists
        cursor.execute("INSERT OR IGNORE INTO business_settings (id, late_threshold, late_penalty) VALUES (1, '10:00', 100.0)")
        
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
