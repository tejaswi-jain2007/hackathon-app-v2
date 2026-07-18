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

# Default password
default_password = sys.argv[1] if len(sys.argv) > 1 else "12345678"
hashed_password = generate_password_hash(default_password)

try:
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()
    
    # Update password for all users with role 'team'
    cursor.execute("UPDATE users SET password_hash = %s WHERE role = 'team';", (hashed_password,))
    updated_count = cursor.rowcount
    
    # Query all registered teams
    cursor.execute("""
        SELECT t.id, t.name, t.leader_email,
               (SELECT string_agg(u.email, ', ') FROM users u WHERE u.team_id = t.id AND u.role = 'team' AND u.email != t.leader_email) as members
        FROM teams t
        WHERE t.registered = 1
        ORDER BY t.name;
    """)
    teams = cursor.fetchall()
    
    conn.commit()
    
    print(f"Successfully reset passwords for {updated_count} team users.")
    print(f"All registered teams now have the password: {default_password}\n")
    print(f"{'Team ID':<8} | {'Team Name':<30} | {'Leader Email':<40} | {'Teammates'}")
    print("-" * 110)
    for team in teams:
        members_str = team[3] if team[3] else "No other members"
        print(f"{team[0]:<8} | {team[1][:30]:<30} | {team[2][:40]:<40} | {members_str}")
        
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
