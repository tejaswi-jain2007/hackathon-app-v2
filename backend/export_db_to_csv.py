import os
import sys
import csv
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
    
    # 1. Export Users Table
    cursor.execute("SELECT id, name, email, role, team_id, created_at FROM users ORDER BY id;")
    users = cursor.fetchall()
    
    users_csv_path = os.path.join(backend_dir, "users_dump.csv")
    with open(users_csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["User ID", "Name", "Email", "Role", "Team ID", "Created At"])
        for u in users:
            writer.writerow([u["id"], u["name"], u["email"], u["role"], u["team_id"], u["created_at"]])
            
    print(f"Exported {len(users)} users to {users_csv_path}")

    # 2. Export Teams Table
    cursor.execute("SELECT id, name, registered, leader_email, disqualified, members, domain, venue, created_at FROM teams ORDER BY name;")
    teams = cursor.fetchall()
    
    teams_csv_path = os.path.join(backend_dir, "teams_dump.csv")
    with open(teams_csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Team ID", "Team Name", "Registered Status", "Leader Email", "Disqualified Status", "Members JSON", "Domain", "Venue", "Created At"])
        for t in teams:
            writer.writerow([t["id"], t["name"], t["registered"], t["leader_email"], t["disqualified"], t["members"], t["domain"], t["venue"], t["created_at"]])
            
    print(f"Exported {len(teams)} teams to {teams_csv_path}")
    
    cursor.close()
    conn.close()
    print("\nDatabase dump complete. You can open these CSV files directly in Microsoft Excel.")
except Exception as e:
    print(f"Error exporting database: {e}")
