import os
import sys
from datetime import date
from decimal import Decimal
from sqlalchemy import create_engine, text

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database.db import MasterSessionLocal, get_tenant_connection_string
from app.database.master_models import Tenant

def run_report():
    session = MasterSessionLocal()
    try:
        tenants = session.query(Tenant).all()
        for t in tenants:
            if t.subdomain != "do-it-services" and t.subdomain != "do-it":
                continue
            
            print(f"\n========================================")
            print(f"Tenant: '{t.subdomain}' (Database: '{t.db_name}')")
            print(f"========================================")
            
            url = get_tenant_connection_string(t.db_name)
            engine = create_engine(url)
            with engine.connect() as conn:
                # Get all users
                users = conn.execute(text("SELECT id, name, role FROM users")).all()
                
                # We want old balance as of 2026-07-02 (yesterday night).
                # All transactions before 2026-07-03.
                cutoff_date = "2026-07-03"
                
                for u in users:
                    user_id = u[0]
                    user_name = u[1]
                    user_role = u[2]
                    
                    # Fetch collections
                    cols = conn.execute(text("""
                        SELECT c.total_amount, d.note_500, d.note_200, d.note_100, d.note_50, d.note_20, d.note_10, d.coins, d.online_amount, c.collection_date
                        FROM collections c
                        LEFT JOIN denominations d ON d.collection_id = c.id
                        WHERE c.staff_id = :user_id AND c.collection_date < :cutoff_date
                    """), {"user_id": user_id, "cutoff_date": cutoff_date}).all()
                    
                    # Fetch deposits made by user
                    deps = conn.execute(text("""
                        SELECT dep.amount, d.note_500, d.note_200, d.note_100, d.note_50, d.note_20, d.note_10, d.coins, d.online_amount, dep.deposit_date, dep.deposit_type, dep.recipient_staff_id
                        FROM bank_deposits dep
                        LEFT JOIN denominations d ON d.deposit_id = dep.id
                        WHERE dep.staff_id = :user_id AND dep.deposit_date < :cutoff_date
                    """), {"user_id": user_id, "cutoff_date": cutoff_date}).all()
                    
                    # Fetch handovers received by user
                    handovers = conn.execute(text("""
                        SELECT dep.amount, d.note_500, d.note_200, d.note_100, d.note_50, d.note_20, d.note_10, d.coins, d.online_amount, dep.deposit_date
                        FROM bank_deposits dep
                        LEFT JOIN denominations d ON d.deposit_id = dep.id
                        WHERE dep.recipient_staff_id = :user_id AND dep.deposit_type = 'staff' AND dep.deposit_date < :cutoff_date
                    """), {"user_id": user_id, "cutoff_date": cutoff_date}).all()
                    
                    if not cols and not deps and not handovers:
                        continue
                        
                    # Calculate balances
                    note500 = 0
                    note200 = 0
                    note100 = 0
                    note50 = 0
                    note20 = 0
                    note10 = 0
                    coins = Decimal("0.0")
                    online_collected = Decimal("0.0")
                    online_deposited = Decimal("0.0")
                    
                    total_collected = Decimal("0.0")
                    total_deposited = Decimal("0.0")
                    
                    # 1. Add Collections
                    for c in cols:
                        total_collected += Decimal(str(c[0] or 0))
                        note500 += c[1] or 0
                        note200 += c[2] or 0
                        note100 += c[3] or 0
                        note50 += c[4] or 0
                        note20 += c[5] or 0
                        note10 += c[6] or 0
                        coins += Decimal(str(c[7] or 0))
                        online_collected += Decimal(str(c[8] or 0))
                        
                    # 2. Add Handovers Received
                    for h in handovers:
                        total_collected += Decimal(str(h[0] or 0))
                        note500 += h[1] or 0
                        note200 += h[2] or 0
                        note100 += h[3] or 0
                        note50 += h[4] or 0
                        note20 += h[5] or 0
                        note10 += h[6] or 0
                        coins += Decimal(str(h[7] or 0))
                        online_collected += Decimal(str(h[8] or 0))
                        
                    # 3. Subtract Deposits
                    for d in deps:
                        # Exclude virtual deposits
                        if d[10] == 'virtual':
                            continue
                        
                        total_deposited += Decimal(str(d[0] or 0))
                        note500 -= d[1] or 0
                        note200 -= d[2] or 0
                        note100 -= d[3] or 0
                        note50 -= d[4] or 0
                        note20 -= d[5] or 0
                        note10 -= d[6] or 0
                        coins -= Decimal(str(d[7] or 0))
                        online_deposited += Decimal(str(d[8] or 0))
                        
                    net_balance = total_collected - total_deposited
                    
                    # Apply our new logic:
                    # Online balance = max(0, online_collected - online_deposited)
                    # Cash notes in hand = net_balance - online_balance
                    online_balance = max(Decimal("0.0"), online_collected - online_deposited)
                    cash_notes_in_hand = net_balance - online_balance
                    
                    print(f"\nStaff: {user_name} ({user_role.upper()})")
                    print(f"  - Net Balance: ₹{net_balance:,.2f}")
                    print(f"  - Cash Notes:  ₹{cash_notes_in_hand:,.2f}")
                    print(f"  - Online/UPI:  ₹{online_balance:,.2f}")
                    print(f"  - Denominations Breakdown (Raw Cumulative):")
                    print(f"    * 500 x {note500} = ₹{(note500*500):,.2f}")
                    print(f"    * 200 x {note200} = ₹{(note200*200):,.2f}")
                    print(f"    * 100 x {note100} = ₹{(note100*100):,.2f}")
                    print(f"    * 50  x {note50}  = ₹{(note50*50):,.2f}")
                    print(f"    * 20  x {note20}  = ₹{(note20*20):,.2f}")
                    print(f"    * 10  x {note10}  = ₹{(note10*10):,.2f}")
                    print(f"    * Coins:          ₹{coins:,.2f}")
                    print(f"    * (Raw Sum of notes: ₹{(note500*500 + note200*200 + note100*100 + note50*50 + note20*20 + note10*10 + float(coins)):,.2f})")
                    
    except Exception as ex:
        print(f"Error: {ex}")
    finally:
        session.close()

if __name__ == "__main__":
    run_report()
