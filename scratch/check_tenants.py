import psycopg2

def check():
    try:
        conn = psycopg2.connect("postgresql://doit_admin:YourSuperSecretPassword123!@localhost:5432/crediiflow_master")
        cur = conn.cursor()
        cur.execute("SELECT id, name, subdomain, db_name, status FROM tenants")
        tenants = cur.fetchall()
        print("Tenants:")
        for t in tenants:
            print(t)
        cur.close()
        conn.close()
    except Exception as e:
        print("Failed to query master database:", e)

if __name__ == "__main__":
    check()
