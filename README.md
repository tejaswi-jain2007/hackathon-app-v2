# Hackathon Control Room

Production-style full-stack hackathon management app with:

- React + Vite frontend
- Flask REST API backend
- PostgreSQL database (compatible with Supabase/Neon)
- Role-based login for Admin, Judge, Mentor, and Team
- Password hashing and token-based sessions
- Ready for Vercel deployment

## Project Structure

```text
backend/
  app.py
  requirements.txt
  instance/hackathon.db

frontend/
  src/main.jsx
  src/styles.css
  package.json
```

The older root `index.html`, `app.js`, and `styles.css` are the first static prototype. The real upgraded app is now in `backend/` and `frontend/`.

## Getting Started Locally

### Prerequisites
- Python 3.11+
- Node.js 18+
- Git

### Setup Backend

```powershell
# 1. Navigate to backend folder
cd backend

# 2. Create virtual environment (first time only)
python -m venv .venv

# 3. Activate virtual environment
.\.venv\Scripts\Activate.ps1

# 4. Install dependencies
pip install -r requirements.txt

# 5. Run the Flask app (default port: 5001)
python app.py
```

Backend runs on: `http://localhost:5001`

### Setup Frontend (New Terminal)

```powershell
# 1. Navigate to frontend folder
cd frontend

# 2. Install dependencies
npm install

# 3. Run dev server
npm run dev
```

Frontend runs on: `http://localhost:5173`

### Access the App

1. Open browser to `http://localhost:5173` (frontend dev server)
2. The frontend will proxy API calls to `http://localhost:5001`
3. Use demo credentials to log in:
   - **Admin**: `admin@hack.local` / `admin123`
   - **Judge**: `judge1@hack.local` / `judge123`
   - **Mentor**: `mentor1@hack.local` / `mentor123`
   - **Team**: `leader1@team.local` / `team123`

### Notes

- **Database**: The app uses SQLite locally (`backend/instance/hackathon.db`). On Vercel, it connects to PostgreSQL via environment variable `DATABASE_URL`.
- **CORS**: The backend allows requests from `http://localhost:5173` during development.
- **Hot Reload**: Frontend has hot reload enabled. Backend requires restart for changes.

## Run Backend

```powershell
cd backend
.\.venv\Scripts\python.exe app.py
```

Backend URL:

```text
http://localhost:5001/api
```

## Run Frontend

```powershell
cd frontend
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

## Demo Logins

- Admin: `admin@hack.local` / `admin123`
- Judge: `judge1@hack.local` / `judge123`
- Mentor: `mentor1@hack.local` / `mentor123`
- Team: `leader1@team.local` / `team123`

## Features

- Admin sends announcements visible to all dashboards
- Admin registers judges and mentors
- Admin assigns teams to judges and mentors
- Admin disqualifies or restores teams
- Judges score assigned teams and give feedback
- Mentors assign tasks and give feedback to assigned teams
- Teams register with one leader, up to 5 teammates, and one shared password
- Team members log in directly after leader registration
- Teams see leaderboard, announcements, judge feedback, mentor tasks, and task statuses
## Deployment to Vercel & Supabase

**Before deploying:**
1. Build the frontend locally: `cd frontend && npm run build`
2. Commit the `frontend/dist` folder to GitHub

**On Vercel:**
1. **Database**: Create a project on [Supabase](https://supabase.com). Go to **Settings > Database > Connection String** and copy the **URI**.
2. **Connect Repo**: Go to [Vercel](https://vercel.com) and connect your GitHub repository.
3. **Set Environment Variables** in Vercel project settings:
   - `DATABASE_URL`: `postgresql://postgres:ttmyt0731%40%23@db.iystpqhqvdrfsvbaefhb.supabase.co:5432/postgres?sslmode=require`
   - `SECRET_KEY`: Any random string (e.g., `mysecretkey123456789`)
4. **Deploy**: Click "Deploy" and Vercel will automatically deploy your app.
5. **First Admin**: Visit your Vercel URL and create the Admin account.
