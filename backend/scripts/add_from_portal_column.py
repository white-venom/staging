#!/usr/bin/env python3
"""
One-time migration script: Add from_portal_id column to bank_deposits table.
Run this inside the backend container or directly on the database host.
"""
import os
import psycopg2

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/crediiflow_do_it_services")

# Parse connection params from URL (simple)
# Expected format: postgresql://user:password@host:port/dbname
parts = DATABASE_URL.replace("postgresql://", "").split("/")
dbname = parts[-1]
user_host = parts[0]
user_pass, host_port = user_host.split("@")
user, password = user_pass.split(":", 1)
host, port = host_port.split(":") if ":" in host_port else (host_port, "5432")

print(f"Connecting to: {host}:{port}/{dbname} as {user}")
conn = psycopg2.connect(dbname=dbname, user=user, password=password, host=host, port=port)
conn.autocommit = True
cur = conn.cursor()

# Check if column already exists
cur.execute("""
    SELECT column_name FROM information_schema.columns 
    WHERE table_name='bank_deposits' AND column_name='from_portal_id';
""")
exists = cur.fetchone()

if exists:
    print("Column 'from_portal_id' already exists. Skipping migration.")
else:
    print("Adding column 'from_portal_id' to bank_deposits...")
    cur.execute("""
        ALTER TABLE bank_deposits 
        ADD COLUMN from_portal_id UUID REFERENCES portals(id) ON DELETE SET NULL;
    """)
    print("Column added successfully!")

cur.close()
conn.close()
print("Migration complete.")
