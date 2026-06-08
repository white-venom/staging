import os
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database.db import engine
from app.database.models import Collection, BankDeposit, Denomination, User

with Session(engine) as session:
    users = session.scalars(select(User)).all()
    print("--- USERS ---")
    for u in users:
        print(f"ID: {u.id}, Name: {u.name}, Role: {u.role}")

    print("\n--- COLLECTIONS ---")
    cols = session.scalars(select(Collection)).all()
    for c in cols:
        d = c.denominations
        denom_str = f"500x{d.note_500}, 200x{d.note_200}, 100x{d.note_100}, 50x{d.note_50}, 20x{d.note_20}, 10x{d.note_10}, coins: {d.coins}, online: {d.online_amount}" if d else "None"
        print(f"ID: {c.id}, Staff: {c.staff.name if c.staff else 'N/A'}, Total: {c.total_amount}, Denoms: {denom_str}, Date: {c.created_at}")

    print("\n--- DEPOSITS ---")
    deps = session.scalars(select(BankDeposit)).all()
    for dep in deps:
        d = dep.denominations
        denom_str = f"500x{d.note_500}, 200x{d.note_200}, 100x{d.note_100}, 50x{d.note_50}, 20x{d.note_20}, 10x{d.note_10}, coins: {d.coins}, online: {d.online_amount}" if d else "None"
        print(f"ID: {dep.id}, Staff: {dep.staff.name if dep.staff else 'N/A'}, Type: {dep.deposit_type}, Amount: {dep.amount}, Denoms: {denom_str}, Date: {dep.created_at}")
