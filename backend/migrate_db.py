import sqlite3

def migrate():
    conn = sqlite3.connect('doit_services.db')
    cursor = conn.cursor()
    try:
        cursor.execute('ALTER TABLE bank_deposits ADD COLUMN created_at DATETIME')
        print("Column created_at added.")
    except sqlite3.OperationalError as e:
        print(f"Error or column already exists: {e}")
    
    cursor.execute("UPDATE bank_deposits SET created_at = datetime('now') WHERE created_at IS NULL")
    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
