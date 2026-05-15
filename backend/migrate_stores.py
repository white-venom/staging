import sqlite3
import uuid

def migrate():
    conn = sqlite3.connect('doit_services.db')
    cursor = conn.cursor()
    
    # Create stores table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS stores (
        id CHAR(32) PRIMARY KEY,
        retailer_id CHAR(32) NOT NULL,
        store_name VARCHAR(150) NOT NULL,
        address VARCHAR(255),
        phone VARCHAR(20),
        created_at DATETIME NOT NULL,
        FOREIGN KEY(retailer_id) REFERENCES retailers(id) ON DELETE CASCADE
    )
    ''')
    print("Stores table created.")
    
    # Create an index
    cursor.execute('CREATE INDEX IF NOT EXISTS ix_stores_store_name ON stores (store_name)')
    
    # Modify collections table
    try:
        cursor.execute('ALTER TABLE collections ADD COLUMN store_id CHAR(32) REFERENCES stores(id) ON DELETE SET NULL')
        print("Column store_id added.")
    except sqlite3.OperationalError as e:
        print(f"Error adding store_id: {e}")
        
    try:
        cursor.execute('ALTER TABLE collections DROP COLUMN portal_id')
        print("Column portal_id dropped from collections.")
    except sqlite3.OperationalError as e:
        print(f"Error dropping portal_id: {e}")

    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
