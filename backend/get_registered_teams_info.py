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
    
    # Query all registered teams
    cursor.execute("""
        SELECT id, name, leader_email, created_at 
        FROM teams 
        WHERE registered = 1 
        ORDER BY name;
    """)
    teams = cursor.fetchall()
    
    print(f"Total Registered Teams: {len(teams)}\n")
    print(f"{'Team ID':<8} | {'Team Name':<30} | {'Leader Email':<40} | {'Password Hash (First 20 chars)':<25}")
    print("-" * 110)
    
    for team in teams:
        # Get the password hash of the leader
        cursor.execute("SELECT password_hash FROM users WHERE team_id = %s AND email = %s;", (team['id'], team['leader_email']))
        user_row = cursor.fetchone()
        pass_hash = user_row['password_hash'] if user_row else "N/A"
        
        # Get all team member emails
        cursor.execute("SELECT email FROM users WHERE team_id = %s AND role = 'team' AND email != %s ORDER BY id;", (team['id'], team['leader_email']))
        members = [r['email'] for r in cursor.fetchall()]
        
        hash_preview = pass_hash[:20] + "..." if pass_hash != "N/A" else "N/A"
        print(f"{team['id']:<8} | {team['name'][:30]:<30} | {team['leader_email'][:40]:<40} | {hash_preview:<25}")
        if members:
            print(f"         └─ Members: {', '.join(members)}")
            
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
