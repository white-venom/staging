import sqlite3
import os

db_path = "doit_services.db"

def migrate():
    if not os.path.exists(db_path):
        # Also check parent directory just in case of different Cwd
        db_path_alt = os.path.join("backend", db_path)
        if os.path.exists(db_path_alt):
            db_file = db_path_alt
        else:
            print("Database not found.")
            return
    else:
        db_file = db_path

    print(f"Connecting to database: {db_file}")
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()

    columns_to_add = [
        ("start_km_image_url", "TEXT"),
        ("end_km_image_url", "TEXT"),
        ("start_latitude", "FLOAT"),
        ("start_longitude", "FLOAT"),
        ("end_latitude", "FLOAT"),
        ("end_longitude", "FLOAT")
    ]

    for col_name, col_type in columns_to_add:
        try:
            print(f"Adding column '{col_name}' ({col_type}) to attendance table...")
            cursor.execute(f"ALTER TABLE attendance ADD COLUMN {col_name} {col_type}")
            print(f"Successfully added {col_name}.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print(f"Column '{col_name}' already exists.")
            else:
                print(f"Error adding {col_name}: {e}")

    try:
        # Just in case business_settings is also missing or needs verification
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS business_settings (
                id INTEGER PRIMARY KEY,
                late_threshold TEXT DEFAULT '10:00',
                late_penalty FLOAT DEFAULT 100.0,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("INSERT OR IGNORE INTO business_settings (id, late_threshold, late_penalty) VALUES (1, '10:00', 100.0)")
        print("Business settings checked and seeded.")
    except Exception as e:
        print(f"Settings error: {e}")

    conn.commit()
    conn.close()
    print("Migration finished successfully!")

if __name__ == "__main__":
    migrate()
