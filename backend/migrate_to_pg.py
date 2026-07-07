import re
import os

app_path = 'app.py'

with open(app_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports
content = content.replace('import sqlite3', '''import psycopg2
from psycopg2.extras import DictCursor
from dotenv import load_dotenv
load_dotenv()''')

# 2. get_db setup
sqlite_setup = '''def get_db() -> sqlite3.Connection:
    if "db" not in g:
        db_path = Path(app.config["DATABASE_PATH"])
        db_path.parent.mkdir(parents=True, exist_ok=True)
        g.db = sqlite3.connect(db_path)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db'''

pg_setup = '''class PostgresConnection:
    def __init__(self, conn):
        self.conn = conn

    def execute(self, sql, args=()):
        cursor = self.conn.cursor()
        cursor.execute(sql, args)
        return cursor
        
    def executescript(self, sql):
        cursor = self.conn.cursor()
        cursor.execute(sql)
        self.conn.commit()

    def commit(self):
        self.conn.commit()

    def close(self):
        self.conn.close()

def get_db():
    if "db" not in g:
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            raise ValueError("DATABASE_URL not set in environment")
        g.db = PostgresConnection(psycopg2.connect(db_url, cursor_factory=DictCursor))
    return g.db'''

content = content.replace(sqlite_setup, pg_setup)

# 3. Type hints for Row
content = content.replace('sqlite3.Row | None', 'dict | None')
content = content.replace('sqlite3.Row', 'dict')

# 4. AUTOINCREMENT
content = content.replace('INTEGER PRIMARY KEY AUTOINCREMENT', 'SERIAL PRIMARY KEY')

# 5. Question marks to %s
content = content.replace('?', '%s')

# 6. lastrowid replacement in create_user
# We need to find the INSERT INTO users query and append RETURNING id
insert_users = '''        INSERT INTO users (name, email, password_hash, role, team_id, created_at)
        VALUES (%s, %s, %s, %s, %s, %s)'''

insert_users_returning = '''        INSERT INTO users (name, email, password_hash, role, team_id, created_at)
        VALUES (%s, %s, %s, %s, %s, %s) RETURNING id'''

content = content.replace(insert_users, insert_users_returning)

# And replace cursor.lastrowid
content = content.replace('return int(cursor.lastrowid)', 'return int(cursor.fetchone()[0])')

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Migration applied successfully.")
