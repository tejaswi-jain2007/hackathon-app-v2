import os
import psycopg2
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

# Load env variables
backend_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(backend_dir, ".env"))

db_url = os.getenv("NEON_DB_URL") or os.getenv("DATABASE_URL")
if not db_url:
    print("Error: DATABASE_URL or NEON_DB_URL not set in environment.")
    exit(1)

def test_flow():
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()
    
    try:
        # 1. Clean up existing test team if any
        cursor.execute("DELETE FROM users WHERE email = 'test_leader@example.com';")
        cursor.execute("DELETE FROM teams WHERE name = 'Test Verification Team';")
        conn.commit()
        
        # 2. Insert unregistered team
        cursor.execute(
            "INSERT INTO teams (name, registered, leader_email, created_at) VALUES (%s, %s, %s, NOW()) RETURNING id;",
            ("Test Verification Team", 0, "")
        )
        team_id = cursor.fetchone()[0]
        conn.commit()
        print(f"Created unregistered team with ID: {team_id}")
        
        # 3. Simulate registration
        password = "simplepassword123"
        hashed = generate_password_hash(password)
        
        # Insert leader user
        cursor.execute(
            "INSERT INTO users (name, email, password_hash, role, team_id, created_at) VALUES (%s, %s, %s, %s, %s, NOW()) RETURNING id;",
            ("Test Leader", "test_leader@example.com", hashed, "team", team_id)
        )
        user_id = cursor.fetchone()[0]
        
        # Update team registered status
        cursor.execute(
            "UPDATE teams SET registered = 1, leader_email = %s WHERE id = %s;",
            ("test_leader@example.com", team_id)
        )
        conn.commit()
        print(f"Registered team. Created user ID: {user_id} with email test_leader@example.com")
        
        # 4. Try verifying login
        cursor.execute("SELECT password_hash FROM users WHERE email = %s AND role = %s;", ("test_leader@example.com", "team"))
        row = cursor.fetchone()
        if not row:
            print("Error: User not found in database after insert!")
            return
            
        db_hash = row[0]
        print(f"Database hash: {db_hash}")
        
        # Verify
        match = check_password_hash(db_hash, password)
        print(f"Password match result: {match}")
        
        # 5. Clean up
        cursor.execute("DELETE FROM users WHERE id = %s;", (user_id,))
        cursor.execute("DELETE FROM teams WHERE id = %s;", (team_id,))
        conn.commit()
        print("Cleanup done.")
        
    except Exception as e:
        conn.rollback()
        print(f"Exception occurred during test: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    test_flow()
