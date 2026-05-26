"""
Script to remove extra portal groups, keeping only the first 2.
Run inside the backend container: python cleanup_portals.py
"""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import Session
from app.database.models import PortalGroup, Portal

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://doit_admin:securepassword@db:5432/doit_production")
engine = create_engine(DATABASE_URL)

with Session(engine) as db:
    groups = db.scalars(select(PortalGroup).order_by(PortalGroup.created_at)).all()
    print(f"\nFound {len(groups)} portal groups:")
    for i, g in enumerate(groups):
        portal_count = len(g.portals) if g.portals else 0
        print(f"  [{i+1}] {g.name} | To Take: {g.opening_to_take} | To Give: {g.opening_to_give} | Balance: {g.balance} | Sub-portals: {portal_count}")

    if len(groups) <= 2:
        print("\n✅ Already 2 or fewer portal groups. Nothing to delete.")
    else:
        keep = groups[:2]
        remove = groups[2:]
        print(f"\n🔒 Keeping: {', '.join(g.name for g in keep)}")
        print(f"🗑️  Removing: {', '.join(g.name for g in remove)}")
        
        for g in remove:
            # Delete all sub-portals first
            for p in list(g.portals):
                db.delete(p)
            db.delete(g)
        
        db.commit()
        print(f"\n✅ Deleted {len(remove)} portal groups. {len(keep)} remaining.")

    # Show final state
    remaining = db.scalars(select(PortalGroup).order_by(PortalGroup.created_at)).all()
    print(f"\nFinal portal groups ({len(remaining)}):")
    for g in remaining:
        portal_count = len(g.portals) if g.portals else 0
        print(f"  • {g.name} | To Take: {g.opening_to_take} | To Give: {g.opening_to_give} | Balance: {g.balance} | Sub-portals: {portal_count}")
