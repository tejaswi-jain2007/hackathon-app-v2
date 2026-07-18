import os
import sys
import psycopg2
from psycopg2.extras import DictCursor
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

try:
    conn = psycopg2.connect(db_url, cursor_factory=DictCursor)
    cursor = conn.cursor()
    
    # Query teams matching tech care
    cursor.execute("""
        SELECT id, name, registered, leader_email, disqualified, members, domain, venue
        FROM teams 
        WHERE name ILIKE '%tech%care%' OR name ILIKE '%care%';
    """)
    teams = cursor.fetchall()
    
    print(f"Found {len(teams)} matching teams:\n")
    for t in teams:
        print(f"Team ID: {t['id']} | Name: {t['name']} | Registered: {t['registered']} | Venue: {t['venue']}")
        print(f"  Leader Email: {t['leader_email']}")
        
        # Get users associated with this team
        cursor.execute("SELECT id, name, email, role FROM users WHERE team_id = %s ORDER BY id;", (t['id'],))
        users = cursor.fetchall()
        print(f"  Associated Users ({len(users)}):")
        for u in users:
            print(f"    - User ID: {u['id']} | Name: {u['name']} | Email: {u['email']} | Role: {u['role']}")
        print("-" * 80)
        
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Error querying teams: {e}")
