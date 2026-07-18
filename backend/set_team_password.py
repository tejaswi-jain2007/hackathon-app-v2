import os
import sys
import psycopg2
from werkzeug.security import generate_password_hash
from dotenv import load_dotenv

# Ensure stdout handles unicode/utf-8 characters correctly
sys.stdout.reconfigure(encoding='utf-8')

# Load env variables
backend_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(backend_dir, ".env"))

db_url = os.getenv("NEON_DB_URL") or os.getenv("DATABASE_URL")
if not db_url:
    print("Error: DATABASE_URL or NEON_DB_URL not set in environment.")
    exit(1)

team_id = 607  # ID for Bhumi Labs
new_password = "Rahul@bhumilabs123"
hashed_password = generate_password_hash(new_password)

try:
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()
    
    # Update password for all users in Bhumi Labs team
    cursor.execute("""
        UPDATE users 
        SET password_hash = %s 
        WHERE team_id = %s;
    """, (hashed_password, team_id))
    
    updated_count = cursor.rowcount
    conn.commit()
    
    print(f"Successfully updated password for {updated_count} users of 'Bhumi Labs' (Team ID: {team_id}) to: {new_password}")
    
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Error resetting password: {e}")
