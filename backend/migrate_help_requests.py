import psycopg2
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("Error: DATABASE_URL not found in environment.")
    exit(1)

conn = psycopg2.connect(DATABASE_URL)
cursor = conn.cursor()

try:
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS help_requests (
        id SERIAL PRIMARY KEY,
        team_id INTEGER NOT NULL,
        location TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        resolved_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP
    );
    ''')
    conn.commit()
    print("Successfully created help_requests table.")
except Exception as e:
    print(f"Error creating table: {e}")
finally:
    cursor.close()
    conn.close()
