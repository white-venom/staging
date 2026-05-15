import sqlite3
import os

for f in os.listdir('.'):
    if f.endswith('.db'):
        try:
            conn = sqlite3.connect(f)
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='collections'")
            if cursor.fetchone():
                cursor.execute("SELECT COUNT(*) FROM collections")
                count = cursor.fetchone()[0]
                print(f"{f}: {count} collections")
            conn.close()
        except Exception as e:
            print(f"{f}: Error {e}")
