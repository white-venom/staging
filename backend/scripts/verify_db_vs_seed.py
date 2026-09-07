"""Verify DB balances on VPS - run via docker exec"""
import sys, os
sys.path.insert(0, '/app')

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database.db import get_tenant_connection_string
from app.database.models import Retailer
from scripts.seed_hello import RETAILERS_TO_SEED

engine = create_engine(get_tenant_connection_string("crediiflow_hello"))
Session = sessionmaker(bind=engine)
db = Session()

# Get all DB retailers
db_retailers = db.query(Retailer).order_by(Retailer.retailer_name).all()
db_by_name = {r.retailer_name.strip().lower(): r for r in db_retailers}

# Build seed lookup
seed_by_name = {r['name'].strip().lower(): r for r in RETAILERS_TO_SEED}

print("=" * 90)
print("DB vs KHATABOOK VERIFICATION")
print("=" * 90)

# Check each seed retailer
matched = 0
unmatched_seed = []
mismatched = []

for seed in RETAILERS_TO_SEED:
    key = seed['name'].strip().lower()
    db_r = db_by_name.get(key)
    if db_r:
        matched += 1
        # Check if balances match
        db_take = float(db_r.opening_to_take or 0)
        db_give = float(db_r.opening_to_give or 0)
        if abs(db_take - seed['take']) > 0.01 or abs(db_give - seed['give']) > 0.01:
            mismatched.append({
                'name': seed['name'],
                'seed_take': seed['take'], 'seed_give': seed['give'],
                'db_take': db_take, 'db_give': db_give
            })
    else:
        unmatched_seed.append(seed)

# DB retailers not in seed
db_only = []
for db_r in db_retailers:
    key = db_r.retailer_name.strip().lower()
    if key not in seed_by_name:
        db_only.append(db_r)

print(f"\nTotal DB retailers: {len(db_retailers)}")
print(f"Total seed entries: {len(RETAILERS_TO_SEED)}")
print(f"Matched by name: {matched}")
print(f"Seed entries NOT found in DB: {len(unmatched_seed)}")
print(f"DB retailers NOT in seed: {len(db_only)}")

if mismatched:
    print(f"\nBALANCE MISMATCHES ({len(mismatched)}):")
    for m in mismatched:
        print(f"  {m['name']}: Seed T={m['seed_take']:,.0f}/G={m['seed_give']:,.0f} vs DB T={m['db_take']:,.0f}/G={m['db_give']:,.0f}")
else:
    print("\nAll matched retailers have CORRECT opening balances!")

if unmatched_seed:
    print(f"\nSeed entries not in DB (by name):")
    for s in unmatched_seed:
        bal = f"T={s['take']:,.0f} G={s['give']:,.0f}" if s['take'] or s['give'] else "ZERO"
        print(f"  {s['name']} ({bal})")

if db_only:
    print(f"\nDB-only retailers (not in Khatabook):")
    for r in db_only[:20]:
        print(f"  {r.retailer_name} (T={float(r.opening_to_take):,.0f} G={float(r.opening_to_give):,.0f} Bal={float(r.balance):,.0f})")

# Final totals
db_give_total = sum(float(r.balance) for r in db_retailers if r.balance > 0)
db_take_total = sum(float(-r.balance) for r in db_retailers if r.balance < 0)
print(f"\nDB Dashboard totals:")
print(f"  You will give: Rs {db_give_total:,.0f}")
print(f"  You will get:  Rs {db_take_total:,.0f}")

db.close()
