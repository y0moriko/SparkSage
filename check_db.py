import sqlite3
import os

db_path = 'sparksage.db'
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT key, value FROM config")
        rows = cursor.fetchall()
        for row in rows:
            print(f"{row[0]}: {row[1]}")
    except Exception as e:
        print(f"Error reading DB: {e}")
    finally:
        conn.close()
else:
    print("Database not found")
