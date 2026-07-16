from app import app, init_db, create_user, get_db, register_team_accounts

with app.app_context():
    init_db()
    db = get_db()
    
    print("Seeding demo accounts...")
    
    # Check if admin exists
    if not db.execute("SELECT id FROM users WHERE email='nishant.vijayvargiya@indoreinstitute.com'").fetchone():
        create_user("Nishant Vijayvargiya", "nishant.vijayvargiya@indoreinstitute.com", "iistapratim@srijan2026", "admin")
        print("Created Admin.")

    db.commit()
    print("Seeding complete.")
