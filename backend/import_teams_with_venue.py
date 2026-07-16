import os
import re
import json
import zipfile
import xml.etree.ElementTree as ET
import psycopg2
from dotenv import load_dotenv
from datetime import datetime, timezone

# Load dotenv from current backend directory
backend_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(backend_dir, ".env"))

filepath = r"c:\Users\tejas\Downloads\1.HACKATHON 2026 Attendance Sheet (1).xlsx"
if not os.path.exists(filepath):
    print(f"Error: {filepath} not found.")
    exit(1)

# Connect to database
db_url = os.getenv("NEON_DB_URL") or os.getenv("DATABASE_URL")
if not db_url:
    print("Error: DATABASE_URL or NEON_DB_URL not set in environment.")
    exit(1)

print("Connecting to Neon Database...")
conn = psycopg2.connect(db_url)
cursor = conn.cursor()

# 1. Run migration query first to ensure the column exists
print("Ensuring database schema is updated...")
cursor.execute("ALTER TABLE teams ADD COLUMN IF NOT EXISTS venue TEXT;")
try:
    cursor.execute("ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_leader_email_key CASCADE;")
except Exception as e:
    print(f"Warning: Could not drop constraint: {e}")
conn.commit()

# 2. Clear old team-related tables to start fresh
print("Clearing old teams and related records...")
cursor.execute("DELETE FROM assignments;")
cursor.execute("DELETE FROM scores;")
cursor.execute("DELETE FROM tasks;")
cursor.execute("DELETE FROM help_requests;")
cursor.execute("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE role = 'team');")
cursor.execute("DELETE FROM users WHERE role = 'team';")
cursor.execute("DELETE FROM teams;")
conn.commit()
print("Database cleared successfully.")

# Helper to read strings from xlsx
def parse_xlsx_sheets_and_data(file_path):
    with zipfile.ZipFile(file_path, 'r') as z:
        # Read shared strings
        shared_strings = []
        try:
            sst_xml = z.read('xl/sharedStrings.xml')
            sst_root = ET.fromstring(sst_xml)
            for si in sst_root:
                # Find all text nodes recursively
                text = "".join(t.text for t in si.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t') if t.text)
                shared_strings.append(text)
        except KeyError:
            pass

        # Read workbook structure to map sheet names to sheet files
        workbook_xml = z.read('xl/workbook.xml')
        wb_root = ET.fromstring(workbook_xml)
        sheets_info = []
        for child in wb_root.iter():
            if child.tag.endswith('sheet'):
                name = child.attrib.get('name')
                sheet_id = child.attrib.get('sheetId')
                r_id = child.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
                sheets_info.append((name, sheet_id, r_id))

        rels_xml = z.read('xl/_rels/workbook.xml.rels')
        rels_root = ET.fromstring(rels_xml)
        id_to_target = {}
        for rel in rels_root:
            rid = rel.attrib.get('Id')
            target = rel.attrib.get('Target')
            id_to_target[rid] = target

        extracted_data = {}

        for name, sheet_id, r_id in sheets_info:
            target = id_to_target.get(r_id)
            if not target:
                continue
            sheet_path = f"xl/{target}"
            sheet_xml = z.read(sheet_path)
            sheet_root = ET.fromstring(sheet_xml)

            sheet_rows = []
            for row_el in sheet_root.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
                row_data = {}
                for cell_el in row_el.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                    cell_ref = cell_el.attrib.get('r')
                    cell_type = cell_el.attrib.get('t')
                    val_el = cell_el.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                    val = ""
                    if val_el is not None:
                        val = val_el.text
                        if cell_type == 's':
                            val = shared_strings[int(val)]
                    
                    col_letter = "".join([c for c in cell_ref if c.isalpha()])
                    row_data[col_letter] = val
                
                # Filter empty rows
                if any(v.strip() for v in row_data.values() if v):
                    sheet_rows.append(row_data)
            
            extracted_data[name] = sheet_rows
        
        return extracted_data

print("Parsing Excel Sheet...")
sheets = parse_xlsx_sheets_and_data(filepath)

total_imported = 0

for venue, rows in sheets.items():
    print(f"\nProcessing venue: {venue}...")
    header_found = False
    venue_imported = 0
    
    for row in rows:
        # Detect header row: containing TEAM NAME
        vals = [v.upper().strip() for v in row.values() if isinstance(v, str)]
        if not header_found:
            if 'TEAM NAME' in vals or 'TEAM NAME ' in vals:
                header_found = True
                print(f"  Header row detected in {venue}.")
            continue
        
        # We are in data rows now
        # Col D: TEAM NAME, Col E: DOMAIN, Col B: Email Address
        # Members are Col F (Leader), I (2nd), L (3rd), O (4th), R (5th), U (6th)
        team_name = row.get('D', '').strip()
        domain = row.get('E', '').strip()
        leader_email = row.get('B', '').strip().lower()
        
        if not team_name or team_name.upper().startswith('TEAM NAME') or team_name.upper().startswith('S.NO'):
            continue
            
        # Parse members
        members_raw = [
            row.get('F'), # Leader
            row.get('I'), # Teammate 2
            row.get('L'), # Teammate 3
            row.get('O'), # Teammate 4
            row.get('R'), # Teammate 5
            row.get('U'), # Teammate 6
        ]
        members = [m.strip() for m in members_raw if m and m.strip()]
        
        # Email validation: if empty or invalid email, set to NULL to prevent duplicate key constraint violations
        if not leader_email or not re.match(r"[^@]+@[^@]+\.[^@]+", leader_email):
            leader_email = None

        members_json = json.dumps(members)
        created_at = datetime.now(timezone.utc).isoformat()
        
        # Insert
        try:
            cursor.execute(
                """
                INSERT INTO teams (name, registered, leader_email, disqualified, members, domain, venue, created_at)
                VALUES (%s, 0, %s, 0, %s, %s, %s, %s)
                """,
                (team_name, leader_email, members_json, domain, venue, created_at)
            )
            venue_imported += 1
            total_imported += 1
        except Exception as e:
            print(f"  Error importing team '{team_name}': {e}")
            conn.rollback()
            
    conn.commit()
    print(f"  Imported {venue_imported} teams for venue {venue}.")

conn.close()
print(f"\nCompleted! Total Imported: {total_imported} teams.")
