import os
import psycopg2
from dotenv import load_dotenv
from datetime import datetime, timezone

# Load dotenv from current backend directory
backend_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(backend_dir, ".env"))

db_url = os.getenv("NEON_DB_URL") or os.getenv("DATABASE_URL")
if not db_url:
    print("Error: DATABASE_URL or NEON_DB_URL not set in environment.")
    exit(1)

print("Connecting to Neon Database...")
conn = psycopg2.connect(db_url)
cursor = conn.cursor()

# Clear old schedule
print("Clearing existing schedule...")
cursor.execute("DELETE FROM schedule_events;")
conn.commit()

# Detailed list of schedule events
# Format: (title, description, start_time, end_time, created_at)
# Since the frontend parses start_time and end_time using new Date(), we should use standard ISO strings (e.g. 2026-07-17T10:00:00)
schedule = [
    # Day 1 - Friday, 17 July 2026
    {
        "title": "Team Registration & Briefing",
        "description": "All Team Leaders report to Auditorium-1 for registration and briefing.",
        "start": "2026-07-17T10:00:00",
        "end": None
    },
    {
        "title": "Inauguration Ceremony",
        "description": "Inauguration Ceremony in Auditorium-1 / Outside Library.",
        "start": "2026-07-17T10:10:00",
        "end": "2026-07-17T11:00:00"
    },
    {
        "title": "Allotment & Project Setup",
        "description": "All team members report to their allotted venues and begin project setup.",
        "start": "2026-07-17T11:00:00",
        "end": None
    },
    {
        "title": "First Attendance (Venue-wise)",
        "description": "First Attendance check at respective venues.",
        "start": "2026-07-17T11:30:00",
        "end": None
    },
    {
        "title": "Snacks Break",
        "description": "Snacks Break.",
        "start": "2026-07-17T17:00:00",
        "end": None
    },
    {
        "title": "Second Attendance (Venue-wise)",
        "description": "Second Attendance check at respective venues.",
        "start": "2026-07-17T18:00:00",
        "end": None
    },
    {
        "title": "Dinner",
        "description": "Dinner for all participants, judges, and mentors.",
        "start": "2026-07-17T20:00:00",
        "end": None
    },
    {
        "title": "Mentoring Session with Experts",
        "description": "Mentoring Session with Industry Experts at all venues.",
        "start": "2026-07-17T21:00:00",
        "end": None
    },
    {
        "title": "Third Attendance (Venue-wise)",
        "description": "Third Attendance check at respective venues.",
        "start": "2026-07-17T22:00:00",
        "end": None
    },
    {
        "title": "Midnight Refreshments",
        "description": "Midnight Refreshments.",
        "start": "2026-07-18T00:00:00",
        "end": None
    },
    # Day 2 - Saturday, 18 July 2026
    {
        "title": "Early Morning Tea",
        "description": "Early Morning Tea.",
        "start": "2026-07-18T04:00:00",
        "end": None
    },
    {
        "title": "Fourth Attendance (Venue-wise)",
        "description": "Fourth Attendance check at respective venues.",
        "start": "2026-07-18T05:00:00",
        "end": None
    },
    {
        "title": "Breakfast",
        "description": "Breakfast.",
        "start": "2026-07-18T07:30:00",
        "end": None
    },
    {
        "title": "Fifth Attendance (Venue-wise)",
        "description": "Fifth Attendance check at respective venues.",
        "start": "2026-07-18T09:00:00",
        "end": None
    },
    {
        "title": "Hackathon Submission & Development Ends",
        "description": "Hackathon Submission & Development Ends (24 Hours Completed). All code coding ends.",
        "start": "2026-07-18T10:00:00",
        "end": None
    },
    {
        "title": "Submission & Evaluation Prep",
        "description": "Teams complete project submission and prepare for evaluation.",
        "start": "2026-07-18T10:00:00",
        "end": "2026-07-18T10:30:00"
    },
    {
        "title": "Project Evaluation & Judging",
        "description": "Project Evaluation & Judging by Jury Members at respective venues.",
        "start": "2026-07-18T10:30:00",
        "end": None
    },
    {
        "title": "Lunch Break",
        "description": "Lunch Break for Participants, Jury Members, Mentors, and Volunteers.",
        "start": "2026-07-18T13:30:00",
        "end": None
    },
    {
        "title": "Valedictory & Prize Distribution",
        "description": "Valedictory Ceremony, Winner Announcement & Prize Distribution in Auditorium-1. (After evaluation completion, assemble in Auditorium-1).",
        "start": "2026-07-18T16:30:00",
        "end": None
    }
]

created_at = datetime.now(timezone.utc).isoformat()

print("Inserting schedule events...")
for event in schedule:
    cursor.execute(
        """
        INSERT INTO schedule_events (title, description, start_time, end_time, created_at)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (event["title"], event["description"], event["start"], event["end"], created_at)
    )

conn.commit()
conn.close()
print("Schedule imported successfully!")
