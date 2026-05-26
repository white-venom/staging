import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.core.config import settings

# Create SQLAlchemy engine (configured for PostgreSQL or SQLite testing)
if settings.DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True
    )
else:
    engine = create_engine(
        settings.DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True
    )

# Create a thread-local Session class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for modern SQLAlchemy 2.0 declarative models
class Base(DeclarativeBase):
    pass

# DB Dependency generator helper (for FastAPI integration)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
