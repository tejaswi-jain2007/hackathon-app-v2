from __future__ import annotations

import os
import secrets
import psycopg2
from psycopg2.extras import DictCursor
from psycopg2 import IntegrityError
from dotenv import load_dotenv
load_dotenv()
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path
from typing import Any, Callable

from flask import Flask, g, jsonify, request, send_from_directory
from werkzeug.security import check_password_hash, generate_password_hash


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DB = BASE_DIR / "instance" / "hackathon.db"

def get_static_folder():
    """Find the frontend dist folder with multiple fallback paths."""
    # Try 1: Standard path (frontend/dist in parent directory)
    candidate1 = BASE_DIR.parent / "frontend" / "dist"
    if candidate1.exists() and (candidate1 / "index.html").exists():
        return candidate1
    
    # Try 2: Check if we're in a subdirectory (e.g., Vercel environment)
    candidate2 = Path("/var/task/frontend/dist")
    if candidate2.exists() and (candidate2 / "index.html").exists():
        return candidate2
    
    # Try 3: Check relative to cwd
    candidate3 = Path.cwd() / "frontend" / "dist"
    if candidate3.exists() and (candidate3 / "index.html").exists():
        return candidate3
    
    # Fallback: return the standard path even if it doesn't exist (will serve error message)
    return BASE_DIR.parent / "frontend" / "dist"


def create_app() -> Flask:
    static_folder = get_static_folder()
    
    app = Flask(__name__, static_folder=str(static_folder), static_url_path="/")
    
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-change-me")
    app.config["DATABASE_PATH"] = os.getenv("DATABASE_PATH", str(DEFAULT_DB))
    app.config["FRONTEND_ORIGIN"] = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")



    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get("Origin")
        allowed = False
        if origin:
            if origin.startswith("http://localhost:") or origin.startswith("http://127.0.0.1:"):
                allowed = True
            elif origin.endswith(".vercel.app") or origin == app.config["FRONTEND_ORIGIN"]:
                allowed = True
        response.headers["Access-Control-Allow-Origin"] = origin if allowed else app.config["FRONTEND_ORIGIN"]
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, OPTIONS"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

    @app.before_request
    def handle_options():
        if request.method == "OPTIONS":
            return ("", 204)
        return None

    @app.errorhandler(Exception)
    def handle_exception(e):
        import traceback
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500


    @app.teardown_appcontext
    def close_db(_error=None):
        db = g.pop("db", None)
        if db is not None:
            db.close()

    register_routes(app)
    return app


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class PostgresConnection:
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
        db_url = os.getenv("NEON_DB_URL") or os.getenv("DATABASE_URL")
        if not db_url:
            raise ValueError("DATABASE_URL not set in environment")
        g.db = PostgresConnection(psycopg2.connect(db_url, cursor_factory=DictCursor))
    return g.db


def row_to_dict(row: dict | None) -> dict[str, Any] | None:
    return dict(row) if row else None


def query_all(sql: str, args: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    return [dict(row) for row in get_db().execute(sql, args).fetchall()]


def query_one(sql: str, args: tuple[Any, ...] = ()) -> dict[str, Any] | None:
    return row_to_dict(get_db().execute(sql, args).fetchone())


def json_error(message: str, status: int = 400):
    return jsonify({"error": message}), status


def require_json() -> dict[str, Any]:
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def current_user() -> dict[str, Any] | None:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header.removeprefix("Bearer ").strip()
    if not token:
        return None
    return query_one(
        """
        SELECT users.id, users.name, users.email, users.role, users.team_id
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token = %s
        """,
        (token,),
    )


def login_required(roles: tuple[str, ...] | None = None):
    def decorator(fn: Callable):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = current_user()
            if not user:
                return json_error("Authentication required.", 401)
            if roles and user["role"] not in roles:
                return json_error("You do not have permission for this action.", 403)
            g.user = user
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def init_db() -> None:
    db = get_db()
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS teams (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            registered INTEGER NOT NULL DEFAULT 0,
            leader_email TEXT UNIQUE,
            disqualified INTEGER NOT NULL DEFAULT 0,
            members TEXT,
            domain TEXT,
            created_at TEXT NOT NULL
        );
        ALTER TABLE teams ADD COLUMN IF NOT EXISTS members TEXT;
        ALTER TABLE teams ADD COLUMN IF NOT EXISTS domain TEXT;

        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('admin','judge','mentor','team')),
            team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS assignments (
            id SERIAL PRIMARY KEY,
            person_role TEXT NOT NULL CHECK(person_role IN ('judge','mentor')),
            person_id INTEGER NOT NULL,
            team_id INTEGER NOT NULL,
            UNIQUE(person_role, person_id, team_id),
            FOREIGN KEY(person_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS announcements (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS scores (
            id SERIAL PRIMARY KEY,
            team_id INTEGER NOT NULL,
            judge_id INTEGER NOT NULL,
            points INTEGER NOT NULL CHECK(points >= 0 AND points <= 100),
            feedback TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(team_id, judge_id),
            FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
            FOREIGN KEY(judge_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS tasks (
            id SERIAL PRIMARY KEY,
            team_id INTEGER NOT NULL,
            mentor_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            details TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('pending','working','done')),
            created_at TEXT NOT NULL,
            FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
            FOREIGN KEY(mentor_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS password_resets (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            token TEXT NOT NULL UNIQUE,
            expires_at TEXT NOT NULL,
            used_at TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS schedule_events (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            start_time TEXT NOT NULL,
            end_time TEXT,
            created_at TEXT NOT NULL
        );
        """
    )
    
    try:
        db.execute("ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_name_key CASCADE;")
    except Exception:
        pass
    try:
        db.execute("ALTER TABLE teams ADD CONSTRAINT teams_leader_email_key UNIQUE (leader_email);")
    except Exception:
        pass
        
    db.commit()


def create_user(name: str, email: str, password: str, role: str, team_id: int | None = None) -> int:
    cursor = get_db().execute(
        """
        INSERT INTO users (name, email, password_hash, role, team_id, created_at)
        VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
        """,
        (name.strip(), email.strip().lower(), generate_password_hash(password), role, team_id, now_iso()),
    )
    return int(cursor.fetchone()[0])


def register_team_accounts(team_id: int, leader_email: str, member_emails: list[str], password: str) -> None:
    db = get_db()
    team = query_one("SELECT id, name, registered FROM teams WHERE id = %s", (team_id,))
    if not team:
        raise ValueError("Team not found.")
    if team["registered"]:
        raise ValueError("Team is already registered.")

    emails = normalize_emails([leader_email, *member_emails])
    if len(emails) > 6:
        raise ValueError("A team can have only 1 leader and 5 teammates.")
    for email in emails:
        if query_one("SELECT id FROM users WHERE email = %s", (email,)):
            raise ValueError(f"{email} is already registered.")

    db.execute(
        "UPDATE teams SET registered = 1, leader_email = %s WHERE id = %s",
        (leader_email.strip().lower(), team_id),
    )
    create_user(f"{team['name']} Leader", leader_email, password, "team", team_id)
    for index, email in enumerate(emails[1:], start=1):
        create_user(f"{team['name']} Member {index}", email, password, "team", team_id)


def normalize_emails(values: list[str]) -> list[str]:
    clean: list[str] = []
    for value in values:
        for email in str(value or "").replace("\n", ",").split(","):
            email = email.strip().lower()
            if email and email not in clean:
                clean.append(email)
    return clean


def create_reset_token(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
    get_db().execute(
        "INSERT INTO password_resets (user_id, token, expires_at, created_at) VALUES (%s, %s, %s, %s)",
        (user_id, token, expires_at, now_iso()),
    )
    reset_log = BASE_DIR / "instance" / "password_resets.log"
    reset_log.parent.mkdir(parents=True, exist_ok=True)
    with reset_log.open("a", encoding="utf-8") as file:
        file.write(f"{now_iso()} user_id={user_id} token={token}\n")
    return token


def set_assignments(person_role: str, person_id: int, team_ids: list[int]) -> None:
    db = get_db()
    db.execute("DELETE FROM assignments WHERE person_role = %s AND person_id = %s", (person_role, person_id))
    for team_id in team_ids:
        db.execute(
            "INSERT INTO assignments (person_role, person_id, team_id) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
            (person_role, person_id, int(team_id)),
        )


def person_is_assigned(person_role: str, person_id: int, team_id: int) -> bool:
    return bool(
        query_one(
            "SELECT id FROM assignments WHERE person_role = %s AND person_id = %s AND team_id = %s",
            (person_role, person_id, team_id),
        )
    )


def get_team_ids_for_person(person_role: str, person_id: int) -> list[int]:
    return [
        row["team_id"]
        for row in query_all(
            "SELECT team_id FROM assignments WHERE person_role = %s AND person_id = %s",
            (person_role, person_id),
        )
    ]


def serialize_team(row: dict[str, Any]) -> dict[str, Any]:
    members = query_all(
        "SELECT id, name, email FROM users WHERE role = 'team' AND team_id = %s ORDER BY id",
        (row["id"],),
    )
    import json
    members_list = []
    if row.get("members"):
        try:
            members_list = json.loads(row["members"])
        except Exception:
            pass

    return {
        "id": row["id"],
        "name": row["name"],
        "registered": bool(row["registered"]),
        "leaderEmail": row["leader_email"],
        "disqualified": bool(row["disqualified"]),
        "members": members,
        "member_names": members_list,
        "domain": row.get("domain", "")
    }


def serialize_person(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "role": row["role"],
        "assignedTeamIds": get_team_ids_for_person(row["role"], row["id"]),
    }


def dashboard_payload(user: dict[str, Any]) -> dict[str, Any]:
    teams = [serialize_team(row) for row in query_all("SELECT * FROM teams ORDER BY name")]
    judges = [serialize_person(row) for row in query_all("SELECT * FROM users WHERE role = 'judge' ORDER BY name")]
    mentors = [serialize_person(row) for row in query_all("SELECT * FROM users WHERE role = 'mentor' ORDER BY name")]
    announcements = query_all("SELECT * FROM announcements ORDER BY id DESC")
    scores = query_all("SELECT * FROM scores ORDER BY updated_at DESC")
    tasks = query_all("SELECT * FROM tasks ORDER BY id DESC")
    schedule_events = query_all("SELECT * FROM schedule_events ORDER BY start_time ASC")
    return {
        "user": user,
        "teams": teams,
        "judges": judges,
        "mentors": mentors,
        "announcements": announcements,
        "scores": scores,
        "tasks": tasks,
        "scheduleEvents": schedule_events,
        "leaderboard": leaderboard(),
    }


def leaderboard() -> list[dict[str, Any]]:
    rows = query_all(
        """
        SELECT
            teams.id,
            teams.name,
            teams.disqualified,
            COALESCE(SUM(scores.points), 0) AS total,
            COUNT(scores.id) AS judgedBy
        FROM teams
        LEFT JOIN scores ON scores.team_id = teams.id
        GROUP BY teams.id
        ORDER BY teams.disqualified ASC, total DESC, teams.name ASC
        """
    )
    rank = 0
    result = []
    for row in rows:
        is_disqualified = bool(row["disqualified"])
        if not is_disqualified:
            rank += 1
        result.append(
            {
                "id": row["id"],
                "name": row["name"],
                "disqualified": is_disqualified,
                "rank": "-" if is_disqualified else rank,
                "total": 0 if is_disqualified else row["total"],
                "judgedBy": row.get("judgedBy", row.get("judgedby")),
            }
        )
    return result


def register_routes(app: Flask) -> None:
    # Serve frontend static files and SPA routing
    @app.get("/")
    def serve_frontend():
        try:
            return send_from_directory(app.static_folder, "index.html")
        except Exception as e:
            return jsonify({"error": str(e), "static_folder": app.static_folder}), 404

    @app.get("/<path:path>")
    def serve_static(path):
        try:
            # Don't serve API routes through static
            if path.startswith("api/"):
                return jsonify({"error": "Not found"}), 404
            
            file_path = Path(app.static_folder) / path
            
            # If file exists, serve it
            if file_path.exists() and file_path.is_file():
                return send_from_directory(app.static_folder, path)
            
            # For any other path, serve index.html for client-side routing
            return send_from_directory(app.static_folder, "index.html")
        except Exception as e:
            # Fallback to index.html for client-side routing
            try:
                return send_from_directory(app.static_folder, "index.html")
            except:
                return jsonify({"error": "Frontend not available"}), 404

    @app.cli.command("init-db")
    def init_db_command():
        init_db()
        print("Database initialized.")

    @app.get("/api/health")
    def health():
        init_db()
        admin_exists = bool(query_one("SELECT id FROM users WHERE role = 'admin' LIMIT 1"))
        return jsonify({"status": "ok", "adminConfigured": admin_exists})

    @app.get("/api/public/teams")
    def public_teams():
        init_db()
        teams = query_all(
            "SELECT id, name, registered FROM teams WHERE registered = 0 AND disqualified = 0 ORDER BY name"
        )
        return jsonify({"teams": teams})

    @app.get("/api/auth/setup-status")
    def setup_status():
        init_db()
        admin_exists = bool(query_one("SELECT id FROM users WHERE role = 'admin' LIMIT 1"))
        return jsonify({"adminConfigured": admin_exists})

    @app.post("/api/auth/admin-register")
    def admin_register():
        init_db()
        data = require_json()
        if query_one("SELECT id FROM users WHERE role = 'admin' LIMIT 1"):
            return json_error("Admin is already registered. Only one admin account is allowed.", 409)
        name = str(data.get("name", "")).strip()
        email = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", ""))
        if not name or not email or len(password) < 8:
            return json_error("Name, email, and an 8 character password are required.")
        try:
            user_id = create_user(name, email, password, "admin")
            token = secrets.token_urlsafe(32)
            get_db().execute(
                "INSERT INTO sessions (token, user_id, created_at) VALUES (%s, %s, %s)",
                (token, user_id, now_iso()),
            )
            get_db().commit()
            user = query_one("SELECT id, name, email, role, team_id FROM users WHERE id = %s", (user_id,))
            return jsonify({"token": token, "user": user, "dashboard": dashboard_payload(user)}), 201
        except IntegrityError:
            get_db().rollback()
            return json_error("This email is already registered.")

    @app.post("/api/auth/login")
    def login():
        init_db()
        data = require_json()
        role = str(data.get("role", "")).lower()
        email = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", ""))
        if role == "admin" and not query_one("SELECT id FROM users WHERE role = 'admin' LIMIT 1"):
            return json_error("No admin account exists yet. Register the first admin first.", 404)
        user = query_one("SELECT * FROM users WHERE email = %s AND role = %s", (email, role))
        if not user or not check_password_hash(user["password_hash"], password):
            return json_error("Invalid email, password, or role.", 401)

        token = secrets.token_urlsafe(32)
        get_db().execute(
            "INSERT INTO sessions (token, user_id, created_at) VALUES (%s, %s, %s)",
            (token, user["id"], now_iso()),
        )
        get_db().commit()
        public_user = {key: user[key] for key in ("id", "name", "email", "role", "team_id")}
        return jsonify({"token": token, "user": public_user, "dashboard": dashboard_payload(public_user)})

    @app.post("/api/auth/logout")
    @login_required()
    def logout():
        token = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
        get_db().execute("DELETE FROM sessions WHERE token = %s", (token,))
        get_db().commit()
        return jsonify({"ok": True})

    @app.post("/api/auth/team-register")
    def team_register():
        init_db()
        data = require_json()
        try:
            team_id = int(data.get("teamId"))
            leader_email = str(data.get("leaderEmail", "")).strip()
            member_emails = normalize_emails(data.get("memberEmails", []))
            password = str(data.get("password", ""))
            if not leader_email or len(password) < 8:
                return json_error("Leader email and an 8 character password are required.")
            register_team_accounts(team_id, leader_email, member_emails, password)
            get_db().commit()
            return jsonify({"ok": True})
        except (TypeError, ValueError) as error:
            get_db().rollback()
            return json_error(str(error))

    @app.post("/api/auth/forgot-password")
    def forgot_password():
        init_db()
        data = require_json()
        role = str(data.get("role", "")).lower()
        email = str(data.get("email", "")).strip().lower()
        user = query_one("SELECT id FROM users WHERE email = %s AND role = %s", (email, role))
        if user:
            create_reset_token(user["id"])
            get_db().commit()
        return jsonify(
            {
                "ok": True,
                "message": "If the account exists, a reset token has been generated in backend/instance/password_resets.log.",
            }
        )

    @app.post("/api/auth/reset-password")
    def reset_password():
        init_db()
        data = require_json()
        token = str(data.get("token", "")).strip()
        password = str(data.get("password", ""))
        if len(password) < 8:
            return json_error("New password must be at least 8 characters.")
        reset = query_one(
            """
            SELECT * FROM password_resets
            WHERE token = %s AND used_at IS NULL AND expires_at > %s
            """,
            (token, now_iso()),
        )
        if not reset:
            return json_error("Reset token is invalid or expired.", 400)
        get_db().execute(
            "UPDATE users SET password_hash = %s WHERE id = %s",
            (generate_password_hash(password), reset["user_id"]),
        )
        get_db().execute("UPDATE password_resets SET used_at = %s WHERE id = %s", (now_iso(), reset["id"]))
        get_db().execute("DELETE FROM sessions WHERE user_id = %s", (reset["user_id"],))
        get_db().commit()
        return jsonify({"ok": True, "message": "Password updated. Please sign in again."})

    @app.get("/api/dashboard")
    @login_required()
    def dashboard():
        return jsonify(dashboard_payload(g.user))

    @app.post("/api/schedule")
    @login_required(("admin",))
    def create_schedule_event():
        data = require_json()
        title = str(data.get("title", "")).strip()
        description = str(data.get("description", "")).strip()
        start_time = str(data.get("startTime", "")).strip()
        end_time = str(data.get("endTime", "")).strip()
        if not title or not start_time:
            return json_error("Title and start time are required.")
        get_db().execute(
            "INSERT INTO schedule_events (title, description, start_time, end_time, created_at) VALUES (%s, %s, %s, %s, %s)",
            (title, description, start_time, end_time, now_iso()),
        )
        get_db().commit()
        return jsonify(dashboard_payload(g.user)), 201

    @app.delete("/api/schedule/<int:event_id>")
    @login_required(("admin",))
    def delete_schedule_event(event_id: int):
        get_db().execute("DELETE FROM schedule_events WHERE id = %s", (event_id,))
        get_db().commit()
        return jsonify(dashboard_payload(g.user))

    @app.post("/api/announcements")
    @login_required(("admin",))
    def create_announcement():
        data = require_json()
        title = str(data.get("title", "")).strip()
        body = str(data.get("body", "")).strip()
        if not title or not body:
            return json_error("Title and message are required.")
        get_db().execute(
            "INSERT INTO announcements (title, body, created_at) VALUES (%s, %s, %s)",
            (title, body, now_iso()),
        )
        get_db().commit()
        return jsonify(dashboard_payload(g.user)), 201

    @app.post("/api/people")
    @login_required(("admin",))
    def create_person():
        data = require_json()
        role = str(data.get("role", "")).lower()
        name = str(data.get("name", "")).strip()
        email = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", ""))
        if role not in ("judge", "mentor"):
            return json_error("Only judges and mentors can be registered here.")
        if not name or not email or len(password) < 8:
            return json_error("Name, email, and a password of at least 8 characters are required.")
        try:
            create_user(name, email, password, role)
            get_db().commit()
            return jsonify(dashboard_payload(g.user)), 201
        except IntegrityError:
            get_db().rollback()
            return json_error("This email is already registered.")

    @app.post("/api/teams")
    @login_required(("admin",))
    def create_team():
        data = require_json()
        name = str(data.get("name", "")).strip()
        if not name:
            return json_error("Team name is required.")
        db = get_db()
        try:
            db.execute("INSERT INTO teams (name, registered, leader_email, created_at) VALUES (%s, %s, %s, NOW())", (name, 0, ""))
            db.commit()
            return jsonify(dashboard_payload(g.user)), 201
        except Exception as e:
            db.rollback()
            return json_error("Team name already exists.")

    @app.post("/api/teams/bulk")
    @login_required(("admin",))
    def bulk_add_teams():
        data = require_json()
        teams = data.get("teams", [])
        if not isinstance(teams, list) or not teams:
            return json_error("A non-empty list of teams is required.")
        
        db = get_db()
        added_count = 0
        skipped_count = 0
        import json

        for t in teams:
            name = str(t.get("name", "")).strip()
            leader_email = str(t.get("leader_email", "")).strip()
            leader_name = str(t.get("leader_name", "Team Leader")).strip()
            members_list = t.get("members", [])
            members_json = json.dumps(members_list) if members_list else None

            domain = str(t.get("domain", "")).strip()

            if not name:
                skipped_count += 1
                continue

            # Check if team exists by leader_email
            existing_team = query_one("SELECT id FROM teams WHERE leader_email = %s", (leader_email,))
            if existing_team:
                skipped_count += 1
                continue
            
            try:
                # Insert team with registered = 0 so they can register themselves later
                db.execute(
                    "INSERT INTO teams (name, registered, leader_email, members, domain, created_at) VALUES (%s, %s, %s, %s, %s, NOW())",
                    (name, 0, leader_email, members_json, domain)
                )
                db.commit()
                added_count += 1
            except Exception as e:
                db.rollback()
                skipped_count += 1

        return jsonify({"message": f"Successfully added {added_count} teams. Skipped {skipped_count} (duplicates/invalid)." })

    @app.patch("/api/assignments")
    @login_required(("admin",))
    def update_assignments():
        data = require_json()
        role = str(data.get("role", "")).lower()
        person_id = int(data.get("personId", 0))
        team_ids = [int(team_id) for team_id in data.get("teamIds", [])]
        person = query_one("SELECT id FROM users WHERE id = %s AND role = %s", (person_id, role))
        if role not in ("judge", "mentor") or not person:
            return json_error("Valid judge or mentor is required.")
        set_assignments(role, person_id, team_ids)
        get_db().commit()
        return jsonify(dashboard_payload(g.user))

    @app.patch("/api/teams/<int:team_id>/disqualification")
    @login_required(("admin",))
    def toggle_disqualification(team_id: int):
        data = require_json()
        disqualified = 1 if bool(data.get("disqualified")) else 0
        get_db().execute("UPDATE teams SET disqualified = %s WHERE id = %s", (disqualified, team_id))
        get_db().commit()
        return jsonify(dashboard_payload(g.user))

    @app.post("/api/scores")
    @login_required(("judge",))
    def create_score():
        data = require_json()
        team_id = int(data.get("teamId", 0))
        points = int(data.get("points", -1))
        feedback = str(data.get("feedback", "")).strip()
        team = query_one("SELECT disqualified FROM teams WHERE id = %s", (team_id,))
        if not team or team["disqualified"]:
            return json_error("This team cannot be scored.")
        if not person_is_assigned("judge", g.user["id"], team_id):
            return json_error("This team is not assigned to you.", 403)
        if points < 0 or points > 100 or not feedback:
            return json_error("Points must be 0-100 and feedback is required.")
        get_db().execute(
            """
            INSERT INTO scores (team_id, judge_id, points, feedback, updated_at)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT(team_id, judge_id)
            DO UPDATE SET points = excluded.points, feedback = excluded.feedback, updated_at = excluded.updated_at
            """,
            (team_id, g.user["id"], points, feedback, now_iso()),
        )
        get_db().commit()
        return jsonify(dashboard_payload(g.user))

    @app.post("/api/tasks")
    @login_required(("mentor",))
    def create_task():
        data = require_json()
        team_id = int(data.get("teamId", 0))
        title = str(data.get("title", "")).strip()
        details = str(data.get("details", "")).strip()
        team = query_one("SELECT disqualified FROM teams WHERE id = %s", (team_id,))
        if not team or team["disqualified"]:
            return json_error("This team cannot receive tasks.")
        if not person_is_assigned("mentor", g.user["id"], team_id):
            return json_error("This team is not assigned to you.", 403)
        if not title or not details:
            return json_error("Task title and details are required.")
        get_db().execute(
            "INSERT INTO tasks (team_id, mentor_id, title, details, status, created_at) VALUES (%s, %s, %s, %s, %s, %s)",
            (team_id, g.user["id"], title, details, "pending", now_iso()),
        )
        get_db().commit()
        return jsonify(dashboard_payload(g.user)), 201

    @app.patch("/api/tasks/<int:task_id>/status")
    @login_required(("team",))
    def update_task_status(task_id: int):
        data = require_json()
        status = str(data.get("status", "")).lower()
        if status not in ("pending", "working", "done"):
            return json_error("Invalid task status.")
        task = query_one("SELECT team_id FROM tasks WHERE id = %s", (task_id,))
        if not task or task["team_id"] != g.user["team_id"]:
            return json_error("Task not found for this team.", 404)
        get_db().execute("UPDATE tasks SET status = %s WHERE id = %s", (status, task_id))
        get_db().commit()
        return jsonify(dashboard_payload(g.user))

app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5001))
    app.run(port=port, debug=True)
