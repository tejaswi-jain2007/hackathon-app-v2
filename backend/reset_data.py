from app import get_db, app

with app.app_context():
    db = get_db()
    
    print("Clearing all demo data...")
    db.execute("DELETE FROM assignments")
    db.execute("DELETE FROM scores")
    db.execute("DELETE FROM announcements")
    db.execute("DELETE FROM tasks")
    db.execute("DELETE FROM teams")
    
    # Delete all users EXCEPT the first registered admin to avoid locking the user out
    db.execute("DELETE FROM users WHERE role != 'admin'")
    
    db.commit()
    print("Demo data cleared successfully.")
