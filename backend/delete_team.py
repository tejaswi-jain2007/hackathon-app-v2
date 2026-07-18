import os
import sys
import psycopg2
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

team_id = 566  # Option B: Hack_Me_Not with college IDs

try:
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()
    
    # 1. Fetch team name for confirmation log
    cursor.execute("SELECT name FROM teams WHERE id = %s;", (team_id,))
    row = cursor.fetchone()
    if not row:
        print(f"Error: Team ID {team_id} not found in database.")
        sys.exit(1)
    team_name = row[0]
    
    print(f"Deleting team '{team_name}' (ID: {team_id})...")
    
    # 2. Delete all users associated with this team
    cursor.execute("DELETE FROM users WHERE team_id = %s;", (team_id,))
    users_deleted = cursor.rowcount
    print(f"Deleted {users_deleted} users associated with team '{team_name}'.")
    
    # 3. Delete the team record itself
    cursor.execute("DELETE FROM teams WHERE id = %s;", (team_id,))
    conn.commit()
    print(f"Successfully deleted team '{team_name}' (ID: {team_id}) from the database.")
    
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Error deleting team: {e}")
