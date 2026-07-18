import os
import sys
import argparse
import psycopg2
from psycopg2.extras import DictCursor
from dotenv import load_dotenv

# Load env variables
backend_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(backend_dir, ".env"))

db_url = os.getenv("NEON_DB_URL") or os.getenv("DATABASE_URL")
if not db_url:
    print("Error: DATABASE_URL or NEON_DB_URL not set in environment.")
    sys.exit(1)

def get_connection():
    return psycopg2.connect(db_url, cursor_factory=DictCursor)

def list_registered_teams(conn):
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT t.id, t.name, t.leader_email, MAX(u.created_at) as last_reg_time, COUNT(u.id) as user_count
            FROM teams t
            JOIN users u ON u.team_id = t.id
            WHERE t.registered = 1
            GROUP BY t.id, t.name, t.leader_email
            ORDER BY last_reg_time DESC;
        """)
        rows = cursor.fetchall()
        
        if not rows:
            print("No teams are currently registered.")
            return []
            
        print(f"\n{'ID':<6} | {'Team Name':<30} | {'Leader Email':<40} | {'Reg Time (UTC)':<25} | {'Users':<5}")
        print("-" * 115)
        for r in rows:
            reg_time = r['last_reg_time'] or 'N/A'
            print(f"{r['id']:<6} | {r['name'][:30]:<30} | {r['leader_email'][:40]:<40} | {reg_time[:25]:<25} | {r['user_count']:<5}")
        print("-" * 115)
        return [r['id'] for r in rows]

def rollback_teams(conn, team_ids, bypass_confirm=False):
    if not team_ids:
        print("No team IDs specified for rollback.")
        return
        
    with conn.cursor() as cursor:
        # Get team names for verification
        cursor.execute("SELECT id, name FROM teams WHERE id IN %s;", (tuple(team_ids),))
        teams_to_rollback = cursor.fetchall()
        
        if not teams_to_rollback:
            print("None of the specified team IDs were found.")
            return
            
        print("\nThe following teams will be un-registered (rolled back):")
        for t in teams_to_rollback:
            print(f"  - ID {t['id']}: {t['name']}")
            
        if not bypass_confirm:
            confirm = input("\nAre you sure you want to rollback these teams? (yes/no): ").strip().lower()
            if confirm not in ('y', 'yes'):
                print("Rollback aborted by user.")
                return

        for team in teams_to_rollback:
            tid = team['id']
            tname = team['name']
            print(f"Rolling back team '{tname}' (ID: {tid})...")
            
            # Delete assignments, scores, tasks, sessions, and users for the team
            cursor.execute("DELETE FROM assignments WHERE team_id = %s;", (tid,))
            cursor.execute("DELETE FROM scores WHERE team_id = %s;", (tid,))
            cursor.execute("DELETE FROM tasks WHERE team_id = %s;", (tid,))
            
            # Sessions are deleted cascadingly when we delete users, but let's be thorough
            cursor.execute("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE role = 'team' AND team_id = %s);", (tid,))
            cursor.execute("DELETE FROM users WHERE role = 'team' AND team_id = %s;", (tid,))
            
            # Reset the team registration status
            cursor.execute("UPDATE teams SET registered = 0, leader_email = NULL WHERE id = %s;", (tid,))
            
        conn.commit()
        print("\nRollback completed successfully. These teams will now show up in the registration dropdown list again.")

def rollback_all_teams(conn, bypass_confirm=False):
    with conn.cursor() as cursor:
        cursor.execute("SELECT id, name FROM teams WHERE registered = 1;")
        teams = cursor.fetchall()
        
        if not teams:
            print("No registered teams found to rollback.")
            return
            
        print(f"\nFound {len(teams)} registered teams.")
        if not bypass_confirm:
            confirm = input("Are you sure you want to un-register ALL registered teams? (yes/no): ").strip().lower()
            if confirm not in ('y', 'yes'):
                print("Rollback aborted.")
                return
            
        print("Rolling back all teams...")
        # Clear all assignments, scores, tasks, sessions for team users
        cursor.execute("DELETE FROM assignments;")
        cursor.execute("DELETE FROM scores;")
        cursor.execute("DELETE FROM tasks;")
        cursor.execute("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE role = 'team');")
        cursor.execute("DELETE FROM users WHERE role = 'team';")
        cursor.execute("UPDATE teams SET registered = 0, leader_email = NULL;")
        
        conn.commit()
        print("\nAll registrations rolled back successfully.")

def main():
    parser = argparse.ArgumentParser(description="Hackathon Registration Rollback Utility")
    parser.add_argument("--list", action="store_true", help="List all registered teams")
    parser.add_argument("--rollback", help="Comma-separated list of Team IDs to rollback")
    parser.add_argument("--rollback-all", action="store_true", help="Rollback all registered teams")
    parser.add_argument("-y", "--yes", action="store_true", help="Bypass confirmation prompt")
    
    args = parser.parse_args()
    
    conn = get_connection()
    try:
        if args.list:
            list_registered_teams(conn)
        elif args.rollback:
            ids = [int(i.strip()) for i in args.rollback.split(",") if i.strip().isdigit()]
            rollback_teams(conn, ids, bypass_confirm=args.yes)
        elif args.rollback_all:
            rollback_all_teams(conn, bypass_confirm=args.yes)
        else:
            # Interactive Mode
            print("=== HACKATHON DATABASE ROLLBACK TOOL ===")
            registered_ids = list_registered_teams(conn)
            if not registered_ids:
                return
                
            choice = input("\nEnter team IDs to rollback (comma-separated), 'ALL' to rollback all, or 'EXIT': ").strip()
            if choice.upper() == 'EXIT' or not choice:
                print("Exited.")
                return
            elif choice.upper() == 'ALL':
                rollback_all_teams(conn, bypass_confirm=args.yes)
            else:
                ids = [int(i.strip()) for i in choice.split(",") if i.strip().isdigit()]
                rollback_teams(conn, ids, bypass_confirm=args.yes)
    finally:
        conn.close()

if __name__ == "__main__":
    main()
