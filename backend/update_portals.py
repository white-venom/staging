import sqlite3
import uuid
import datetime

conn = sqlite3.connect('doit_services.db')
c = conn.cursor()

# Clear old portals
c.execute('DELETE FROM portals')

# Insert new banks/portals
new_portals = [
    "HDFC Bank - Current Account",
    "ICICI Bank - Nodal Account",
    "PayTM Virtual Portal",
    "PhonePe Business Wallet"
]

now = datetime.datetime.utcnow().isoformat()

for name in new_portals:
    portal_id = uuid.uuid4().hex
    c.execute('INSERT INTO portals (id, portal_name, created_at) VALUES (?, ?, ?)', (portal_id, name, now))

conn.commit()
conn.close()
print("Portals updated successfully!")
