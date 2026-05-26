import sys
import os
from sqlalchemy import create_engine, text

# Set up module path resolution
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings

db_url = settings.DATABASE_URL
if "db:5432" in db_url:
    db_url = db_url.replace("db:5432", "localhost:5432")

print(f"Connecting to database: {db_url}")
engine = create_engine(db_url)

with engine.connect() as conn:
    try:
        print("Adding virtual_balance column to users table...")
        conn.execute(text("ALTER TABLE users ADD COLUMN virtual_balance NUMERIC(12, 2) DEFAULT 0.00 NOT NULL"))
        conn.commit()
        print("Successfully added column!")
    except Exception as e:
        print(f"Error (maybe column already exists): {e}")
