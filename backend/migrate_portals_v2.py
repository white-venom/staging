import sqlite3
import uuid
import datetime

conn = sqlite3.connect('doit_services.db')
c = conn.cursor()

try:
    # 1. Create portal_groups table
    c.execute('''
        CREATE TABLE IF NOT EXISTS portal_groups (
            id CHAR(32) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            created_at DATETIME NOT NULL
        )
    ''')

    # 2. Add group_id to portals table if it doesn't exist
    try:
        c.execute('ALTER TABLE portals ADD COLUMN group_id CHAR(32) REFERENCES portal_groups(id)')
    except sqlite3.OperationalError:
        print("group_id already exists in portals")

    # 3. Create a default group for existing portals
    now = datetime.datetime.utcnow().isoformat()
    
    # Let's see what portals we have
    c.execute('SELECT id, portal_name FROM portals')
    portals = c.fetchall()
    
    if portals:
        # Create a group named "Legacy Portals" or something, 
        # or better: for each portal, create a group with the same name and make the portal an "Account" under it.
        for pid, pname in portals:
            group_id = uuid.uuid4().hex
            c.execute('INSERT INTO portal_groups (id, name, created_at) VALUES (?, ?, ?)', (group_id, pname, now))
            c.execute('UPDATE portals SET group_id = ?, portal_name = ? WHERE id = ?', (group_id, "Main Account", pid))

    conn.commit()
    print("Migration successful!")
except Exception as e:
    print(f"Migration failed: {e}")
    conn.rollback()
finally:
    conn.close()
