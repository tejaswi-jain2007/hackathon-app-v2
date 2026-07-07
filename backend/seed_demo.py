from app import app, init_db, create_user, get_db, register_team_accounts

with app.app_context():
    init_db()
    db = get_db()
    
    print("Seeding demo accounts...")
    
    # Check if admin demo exists
    if not db.execute("SELECT id FROM users WHERE email='admin@hack.local'").fetchone():
        create_user("Demo Admin", "admin@hack.local", "admin123", "admin")
        print("Created demo Admin.")

    # Check if judge exists
    if not db.execute("SELECT id FROM users WHERE email='judge1@hack.local'").fetchone():
        create_user("Demo Judge", "judge1@hack.local", "judge123", "judge")
        print("Created demo Judge.")

    # Check if mentor exists
    if not db.execute("SELECT id FROM users WHERE email='mentor1@hack.local'").fetchone():
        create_user("Demo Mentor", "mentor1@hack.local", "mentor123", "mentor")
        print("Created demo Mentor.")

    # Check if team exists
    if not db.execute("SELECT id FROM teams WHERE name='Demo Team 1'").fetchone():
        db.execute("INSERT INTO teams (name, registered, leader_email, created_at) VALUES (%s, %s, %s, NOW())", 
                   ("Demo Team 1", 1, "leader1@team.local"))
        team_id = db.execute("SELECT id FROM teams WHERE name='Demo Team 1'").fetchone()[0]
        create_user("Demo Leader 1", "leader1@team.local", "team123", "team", team_id)
        print("Created Demo Team 1 with leader leader1@team.local")
        
    db.commit()
    print("Seeding complete.")
