from app.database.db import SessionLocal
from app.database.models import User, Retailer, Portal
db = SessionLocal()
print(f"Users: {db.query(User).count()}")
print(f"Retailers: {db.query(Retailer).count()}")
print(f"Portals: {db.query(Portal).count()}")
db.close()
