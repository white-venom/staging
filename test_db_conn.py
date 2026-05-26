import psycopg2

def test_conn():
    try:
        conn = psycopg2.connect("postgresql://postgres:password123@localhost:5432/doit_services")
        print("Successfully connected to localhost PostgreSQL.")
        cur = conn.cursor()
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
        tables = cur.fetchall()
        print("Tables in public schema:")
        print(tables)
        cur.close()
        conn.close()
    except Exception as e:
        print("Connection failed:", e)

if __name__ == "__main__":
    test_conn()
