import os
import sys

# Add backend directory to sys.path so we can import app modules
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

# Override settings DATABASE_URL to target docker bridge database IP
os.environ["DATABASE_URL"] = "postgresql://doit_admin:securepassword@172.18.0.2:5432/doit_production"

from sqlalchemy.orm import Session
from app.database.db import SessionLocal
from app.database.models import User
from sqlalchemy import select

def list_users():
    db = SessionLocal()
    try:
        stmt = select(User)
        users = db.scalars(stmt).all()
        print(f"Found {len(users)} users:")
        for u in users:
            print(f"- Name: {u.name}, Phone: {u.phone}, Role: {u.role}")
    finally:
        db.close()

if __name__ == "__main__":
    list_users()
