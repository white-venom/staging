import requests

# Try to get collections via API
try:
    # We need a token. I'll try to find a user and login or just check DB directly.
    # Since I'm on the same machine, I'll check DB again very carefully.
    import sqlite3
    conn = sqlite3.connect('doit_services.db')
    cursor = conn.cursor()
    
    print("Tables in doit_services.db:")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    print(cursor.fetchall())
    
    print("\nRetailers:")
    cursor.execute("SELECT id, retailer_name FROM retailers")
    rets = cursor.fetchall()
    print(rets)
    
    for rid, name in rets:
        cursor.execute("SELECT COUNT(*) FROM collections WHERE retailer_id=?", (rid,))
        count = cursor.fetchone()[0]
        print(f"Retailer {name} ({rid}): {count} collections")
        
    print("\nAll Collections Count:")
    cursor.execute("SELECT COUNT(*) FROM collections")
    print(cursor.fetchone()[0])
    
    conn.close()
except Exception as e:
    print(f"Error: {e}")
