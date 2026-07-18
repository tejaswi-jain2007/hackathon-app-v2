import os
import psycopg2
from dotenv import load_dotenv

# Load env variables
backend_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(backend_dir, ".env"))

db_url = os.getenv("NEON_DB_URL") or os.getenv("DATABASE_URL")
if not db_url:
    print("Error: DATABASE_URL or NEON_DB_URL not set in environment.")
    exit(1)

try:
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()
    
    # Query registered teams
    cursor.execute("SELECT id, name, leader_email, registered FROM teams WHERE registered = 1 ORDER BY name;")
    registered_teams = cursor.fetchall()
    
    print(f"\n--- REGISTERED TEAMS (Count: {len(registered_teams)}) ---")
    for team in registered_teams:
        print(f"ID: {team[0]} | Name: {team[1]} | Leader: {team[2]}")
        
        # Get users created for this team
        cursor.execute("SELECT id, name, email, role FROM users WHERE team_id = %s;", (team[0],))
        users = cursor.fetchall()
        for u in users:
            print(f"  -> User ID: {u[0]} | Name: {u[1]} | Email: {u[2]} | Role: {u[3]}")
            
    # Also count total unregistered teams
    cursor.execute("SELECT COUNT(*) FROM teams WHERE registered = 0;")
    unregistered_count = cursor.fetchone()[0]
    print(f"\nTotal unregistered teams in database: {unregistered_count}")
    
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Error querying database: {e}")
