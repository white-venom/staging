from app.database.db import get_tenant_session
from app.database.models import Retailer, Ledger, BankDeposit, Collection, User

db = get_tenant_session("do-it-services")

ret = db.query(Retailer).filter(Retailer.id == "ebedc6bf-aa6f-45c0-9685-9ef48692459d").first()
if ret:
    print("Retailer Details:")
    print(f"  Name: {ret.retailer_name}")
    print(f"  Phone: {ret.phone}")
    print(f"  Address: {ret.address}")
    print(f"  Opening To Give: ₹{ret.opening_to_give}")
    print(f"  Opening To Take: ₹{ret.opening_to_take}")
    print(f"  Current Balance: ₹{ret.balance}")
    print(f"  Assigned Staff ID: {ret.assigned_staff_id}")
    
    print("\nLedger Entries:")
    entries = db.query(Ledger).filter(Ledger.retailer_id == ret.id).order_by(Ledger.created_at).all()
    for e in entries:
        staff_name = "N/A"
        if e.deposit_id:
            dep = db.query(BankDeposit).filter(BankDeposit.id == e.deposit_id).first()
            if dep:
                staff = db.query(User).filter(User.id == dep.staff_id).first()
                staff_name = staff.name if staff else "N/A"
        elif e.collection_id:
            col = db.query(Collection).filter(Collection.id == e.collection_id).first()
            if col:
                staff = db.query(User).filter(User.id == col.staff_id).first()
                staff_name = staff.name if staff else "N/A"
                
        print(f"  Date: {e.created_at} | Type: {e.transaction_type} | Amount: ₹{e.amount} | Running Bal: ₹{e.balance} | Desc: {e.description} | Staff: {staff_name}")
else:
    print("Retailer not found.")

db.close()
