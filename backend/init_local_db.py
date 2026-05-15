import sys
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Set up module path resolution
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database.db import Base
from app.core.security import get_password_hash
from app.database.models import User

DATABASE_URL = "sqlite:///./doit_services.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    print("Initializing database...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Delete existing Sujeet users to ensure we have the right roles
        db.query(User).filter(User.phone.in_(["7900671145", "9917128864"])).delete(synchronize_session=False)
        
        print("Seeding your credentials...")
        pass_hash = get_password_hash("password123")
        
        # Admin Sujeet
        admin_user = User(
            name="Sujeet (Admin)",
            phone="7900671145",
            role="admin",
            password_hash=pass_hash
        )
        # Staff Sujeet
        staff_user = User(
            name="Sujeet (Staff)",
            phone="9917128864",
            role="staff",
            password_hash=pass_hash
        )
        
        db.add_all([admin_user, staff_user])
        db.commit()
        print("✅ Database updated! You can now login with password 'password123'")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
