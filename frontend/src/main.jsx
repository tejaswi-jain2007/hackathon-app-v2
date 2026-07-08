import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://localhost:5001/api" : "/api");
const roleTabs = ["admin", "judge", "mentor", "team"];
const emptyLogin = { email: "", password: "" };

async function apiRequest(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let text = "";
  let payload = {};
  try {
    text = await response.text();
    payload = JSON.parse(text);
  } catch (e) {
    payload = { error: `Vercel Error [${response.status}]: ${text.substring(0, 150)}` };
  }
  if (!response.ok) {
    throw new Error(payload?.error || "Something went wrong.");
  }
  return payload;
}

function App() {
  const [role, setRole] = useState("admin");
  const [token, setToken] = useState(localStorage.getItem("hcr_token") || "");
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState("");
  const [adminConfigured, setAdminConfigured] = useState(true);
  const [activeTab, setActiveTab] = useState("Overview");

  useEffect(() => {
    setActiveTab("Overview");
  }, [user?.role]);

  useEffect(() => {
    apiRequest("/auth/setup-status")
      .then((payload) => setAdminConfigured(payload.adminConfigured))
      .catch(() => setAdminConfigured(true));
    if (!token) {
      setLoading(false);
      return;
    }
    refreshDashboard(token).catch(() => {
      localStorage.removeItem("hcr_token");
      setToken("");
      setUser(null);
      setData(null);
      setLoading(false);
    });
  }, []);

  async function refreshDashboard(activeToken = token) {
    setLoading(true);
    const payload = await apiRequest("/dashboard", { token: activeToken });
    setUser(payload.user);
    setData(payload);
    setLoading(false);
    return payload;
  }

  async function login(form) {
    setError("");
    const payload = await apiRequest("/auth/login", {
      method: "POST",
      body: { role, email: form.email, password: form.password }
    });
    localStorage.setItem("hcr_token", payload.token);
    setToken(payload.token);
    setUser(payload.user);
    setData(payload.dashboard);
  }

  async function registerAdmin(form) {
    setError("");
    const payload = await apiRequest("/auth/admin-register", { method: "POST", body: form });
    localStorage.setItem("hcr_token", payload.token);
    setToken(payload.token);
    setUser(payload.user);
    setData(payload.dashboard);
    setAdminConfigured(true);
  }

  async function registerTeam(form) {
    setError("");
    await apiRequest("/auth/team-register", { method: "POST", body: form });
    setRole("team");
    setError("Team registered. Use any registered teammate email with the shared password to sign in.");
  }

  async function forgotPassword(form) {
    setError("");
    return apiRequest("/auth/forgot-password", { method: "POST", body: form });
  }

  async function resetPassword(form) {
    setError("");
    return apiRequest("/auth/reset-password", { method: "POST", body: form });
  }

  async function mutate(path, options = {}) {
    setError("");
    const payload = await apiRequest(path, { ...options, token });
    setData(payload);
    if (payload.user) setUser(payload.user);
  }

  async function logout() {
    if (token) {
      await apiRequest("/auth/logout", { method: "POST", token }).catch(() => { });
    }
    localStorage.removeItem("hcr_token");
    setToken("");
    setUser(null);
    setData(null);
  }

  if (loading) return <LoadingScreen />;

  if (!user || !data) {
    return (
      <AuthScreen
        role={role}
        setRole={setRole}
        onLogin={login}
        onRegisterAdmin={registerAdmin}
        onRegisterTeam={registerTeam}
        onForgotPassword={forgotPassword}
        onResetPassword={resetPassword}
        adminConfigured={adminConfigured}
        error={error}
        setError={setError}
      />
    );
  }

  return (
    <DashboardShell user={user} data={data} onLogout={logout} activeTab={activeTab} setActiveTab={setActiveTab}>
      {error && <div className="alert">{error}</div>}
      {user.role === "admin" && <AdminPanel data={data} mutate={mutate} activeTab={activeTab} />}
      {user.role === "judge" && <JudgePanel data={data} user={user} mutate={mutate} activeTab={activeTab} />}
      {user.role === "mentor" && <MentorPanel data={data} user={user} mutate={mutate} activeTab={activeTab} />}
      {user.role === "team" && <TeamPanel data={data} user={user} mutate={mutate} activeTab={activeTab} />}
    </DashboardShell>
  );
}

function LoadingScreen() {
  return (
    <main className="loading-page">
      <div className="loader" />
      <p>Loading control room...</p>
    </main>
  );
}

function AuthScreen({
  role,
  setRole,
  onLogin,
  onRegisterAdmin,
  onRegisterTeam,
  onForgotPassword,
  onResetPassword,
  adminConfigured,
  error,
  setError
}) {
  const [loginForm, setLoginForm] = useState(emptyLogin);
  const [authMode, setAuthMode] = useState("login");

  async function submitLogin(event) {
    event.preventDefault();
    try {
      await onLogin(loginForm);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-visual">
        <div className="brand-chip">Hackathon OS</div>
        <h1>ONE PLATFORM FOR THE TEAMS , JUDGES AND THE MENTORS</h1>
        <div className="signal-grid">
          <Signal title="" value="BE UNSTOPPABLE" />
          <Signal title="" value="24 HOURS" />
          <Signal title="" value="THE UNBEATABLE SPIRIT" />
        </div>
        <div className="demo-box">
          <strong>STAY UPDATED</strong>
          <span>EASY TO USE</span>
          <span>FULL TRANSPARENCY</span>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="section-title">
            <span>{adminConfigured ? "Secure role login" : "First-time setup"}</span>
            <h2>{adminConfigured ? `${label(role)} access` : "Register admin"}</h2>
          </div>
          {adminConfigured && (
            <div className="role-tabs">
              {roleTabs.map((item) => (
                <button key={item} className={role === item ? "active" : ""} onClick={() => setRole(item)}>
                  {label(item)}
                </button>
              ))}
            </div>
          )}
          {error && <div className={error.startsWith("Team registered") ? "success" : "alert"}>{error}</div>}
          {!adminConfigured ? (
            <AdminSetupForm onRegisterAdmin={onRegisterAdmin} setError={setError} />
          ) : authMode === "forgot" ? (
            <ForgotPasswordForm role={role} setAuthMode={setAuthMode} onForgotPassword={onForgotPassword} setError={setError} />
          ) : authMode === "reset" ? (
            <ResetPasswordForm setAuthMode={setAuthMode} onResetPassword={onResetPassword} setError={setError} />
          ) : (
            <>
              <form className="form-stack" onSubmit={submitLogin}>
                <Input label="Email" type="email" value={loginForm.email} onChange={(email) => setLoginForm({ ...loginForm, email })} />
                <Input label="Password" type="password" value={loginForm.password} onChange={(password) => setLoginForm({ ...loginForm, password })} />
                <button className="btn primary" type="submit">Sign in</button>
              </form>
              <div className="auth-actions">
                <button className="link-btn" type="button" onClick={() => setAuthMode("forgot")}>Forgot password</button>
                <button className="link-btn" type="button" onClick={() => setAuthMode("reset")}>Have reset token</button>
              </div>
              {role === "team" && (
                <>
                  <div className="divider" />
                  <TeamRegisterForm onRegisterTeam={onRegisterTeam} setError={setError} />
                </>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function AdminSetupForm({ onRegisterAdmin, setError }) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  async function submit(event) {
    event.preventDefault();
    try {
      await onRegisterAdmin(form);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      <Input label="Admin name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
      <Input label="Admin email" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} />
      <Input label="Password" type="password" value={form.password} onChange={(password) => setForm({ ...form, password })} />
      <button className="btn primary" type="submit">Create admin account</button>
    </form>
  );
}

function ForgotPasswordForm({ role, setAuthMode, onForgotPassword, setError }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    try {
      const payload = await onForgotPassword({ role, email });
      setMessage(payload.message);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      {message && <div className="success">{message}</div>}
      <Input label={`${label(role)} email`} type="email" value={email} onChange={setEmail} />
      <button className="btn primary" type="submit">Request reset</button>
      <button className="btn secondary" type="button" onClick={() => setAuthMode("login")}>Back to login</button>
    </form>
  );
}

function ResetPasswordForm({ setAuthMode, onResetPassword, setError }) {
  const [form, setForm] = useState({ token: "", password: "" });
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    try {
      const payload = await onResetPassword(form);
      setMessage(payload.message);
      setForm({ token: "", password: "" });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      {message && <div className="success">{message}</div>}
      <Input label="Reset token" value={form.token} onChange={(token) => setForm({ ...form, token })} />
      <Input label="New password" type="password" value={form.password} onChange={(password) => setForm({ ...form, password })} />
      <button className="btn primary" type="submit">Update password</button>
      <button className="btn secondary" type="button" onClick={() => setAuthMode("login")}>Back to login</button>
    </form>
  );
}

function TeamRegisterForm({ onRegisterTeam, setError }) {
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState({ teamId: "", leaderEmail: "", memberEmails: ["", "", "", "", ""], password: "" });

  useEffect(() => {
    apiRequest("/public/teams")
      .then((payload) => setTeams(payload.teams))
      .catch(() => setTeams([]));
  }, []);

  async function submit(event) {
    event.preventDefault();
    try {
      await onRegisterTeam(form);
      setForm({ teamId: "", leaderEmail: "", memberEmails: ["", "", "", "", ""], password: "" });
    } catch (err) {
      setError(err.message);
    }
  }

  function updateMemberEmail(index, value) {
    const memberEmails = [...form.memberEmails];
    memberEmails[index] = value;
    setForm({ ...form, memberEmails });
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      <h3>Leader registration</h3>
      <label className="field">
        <span>Choose team</span>
        <select value={form.teamId} onChange={(event) => setForm({ ...form, teamId: event.target.value })} required>
          <option value="">Select team</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>{team.name}</option>
          ))}
        </select>
      </label>
      <Input label="Leader email" type="email" value={form.leaderEmail} onChange={(leaderEmail) => setForm({ ...form, leaderEmail })} />
      <div className="member-email-grid">
        <span>Teammate emails</span>
        {form.memberEmails.map((email, index) => (
          <Input
            key={index}
            label={`Member ${index + 1} email`}
            type="email"
            value={email}
            required={false}
            onChange={(value) => updateMemberEmail(index, value)}
          />
        ))}
      </div>
      <Input label="Shared password" type="password" value={form.password} onChange={(password) => setForm({ ...form, password })} />
      <button className="btn secondary" type="submit">Register team</button>
    </form>
  );
}

function DashboardShell({ user, data, onLogout, children, activeTab, setActiveTab }) {
  const subtitle = {
    admin: "Manage people, assignments, announcements, disqualification, and leaderboard.",
    judge: "Score only the teams assigned by the admin.",
    mentor: "Assign tasks and monitor progress for your teams.",
    team: "Track announcements, score feedback, tasks, and leaderboard rank."
  }[user.role];

  const tabs = {
    admin: ["Overview", "Schedule", "Judges", "Mentors", "Teams", "Announcements", "Leaderboard"],
    judge: ["Overview", "Schedule", "Scoring", "Leaderboard"],
    mentor: ["Overview", "Schedule", "My Teams", "Tasks"],
    team: ["Overview", "Schedule", "Feedback", "Tasks", "Leaderboard"]
  }[user.role];

  return (
    <div className="layout">
      <div className="stars"></div>
      <div className="scene">
        <div className="nebula"></div>
        <div className="petrova-arc"></div>
        <div className="dying-sun"></div>
        <svg className="ship-silhouette" viewBox="0 0 400 160" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="140" cy="80" rx="120" ry="26" fill="#0c121b" stroke="#1d2735" strokeWidth="1.5"/>
          <rect x="230" y="66" width="90" height="28" rx="10" fill="#0c121b" stroke="#1d2735" strokeWidth="1.5"/>
          <circle cx="320" cy="80" r="16" fill="#0f1621" stroke="#7a5a26" strokeWidth="1.5"/>
          <circle cx="320" cy="80" r="6" fill="#f2a53d" opacity=".7"/>
          <rect x="70" y="40" width="18" height="80" rx="4" fill="#0f1621" stroke="#1d2735"/>
          <rect x="150" y="30" width="18" height="100" rx="4" fill="#0f1621" stroke="#1d2735"/>
          <rect x="200" y="40" width="18" height="80" rx="4" fill="#0f1621" stroke="#1d2735"/>
        </svg>
      </div>
      <div className="sun-corner"></div>

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"></div>
          <div>
            <div className="brand-name">Hail Mary</div>
            <div className="brand-sub">Mission control deck</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {tabs.map((tab) => (
            <a
              key={tab}
              className={activeTab === tab ? "active" : ""}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </a>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="admin-card">
            <span className="admin-badge">{label(user.role)}</span>
            <div className="admin-name">{user.name}</div>
            <div className="admin-email">{user.email}</div>
          </div>
          <button className="logout-btn" onClick={onLogout}>Log out</button>
        </div>
      </aside>

      <main className="workspace">
        <div className="eyebrow">Ship computer · {label(user.role)} workspace</div>
        <div className="head-row">
          <div>
            <h1>{user.role === "team" ? findTeam(data, user.team_id)?.name || "Team Dashboard" : "Mission control"}</h1>
            <p className="subtitle">{subtitle}</p>
          </div>
          <div className="pill-row">
            <span className="pill">{data.teams.filter((team) => team.registered).length} registered</span>
            <span className="pill">{data.leaderboard.filter((team) => !team.disqualified).length} active</span>
          </div>
        </div>

        <div className="petrova">
          <span className="petrova-label">petrova line · 96.86 MHz</span>
        </div>

        {children}
      </main>
    </div>
  );
}

function AdminPanel({ data, mutate, activeTab }) {
  return (
    <>
      <div className="content-grid">
        <section className="left-column" style={{ minHeight: "60vh" }}>
          {activeTab === "Overview" && <MetricGrid data={data} />}
          {activeTab === "Schedule" && <SchedulePanel data={data} mutate={mutate} isAdmin={true} />}
          {activeTab === "Judges" && <PeopleManager title="Judges" role="judge" people={data.judges} teams={data.teams} mutate={mutate} />}
          {activeTab === "Mentors" && <PeopleManager title="Mentors" role="mentor" people={data.mentors} teams={data.teams} mutate={mutate} />}
          {activeTab === "Teams" && (
            <>
              <AddTeamForm mutate={mutate} />
              <BulkAddTeamForm mutate={mutate} />
              <TeamAdmin teams={data.teams} mutate={mutate} />
            </>
          )}
          {activeTab === "Announcements" && (
            <>
              <AnnouncementForm mutate={mutate} />
              <NoticeBoard announcements={data.announcements} />
            </>
          )}
          {activeTab === "Leaderboard" && <Leaderboard data={data} />}
        </section>
        {activeTab !== "Leaderboard" && (
          <aside className="right-column">
            <Leaderboard data={data} />
            {activeTab !== "Announcements" && <NoticeBoard announcements={data.announcements} />}
          </aside>
        )}
      </div>
    </>
  );
}

function AddTeamForm({ mutate }) {
  const [name, setName] = useState("");

  async function submit(event) {
    event.preventDefault();
    await mutate("/teams", { method: "POST", body: { name } });
    setName("");
  }

  return (
    <Panel title="Add team" meta="Appears in team registration dropdown">
      <form className="inline-form compact" onSubmit={submit}>
        <Input label="Team name" value={name} onChange={setName} />
        <button className="btn primary" type="submit">Add team</button>
      </form>
    </Panel>
  );
}

function BulkAddTeamForm({ mutate }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    setLoading(true);
    setMessage("");
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      const lines = text.split("\n").map(l => l.trim()).filter(l => l);
      if (lines.length < 2) {
        setMessage("File is empty or missing headers.");
        setLoading(false);
        return;
      }
      
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const teams = [];
      
      for (let i = 1; i < lines.length; i++) {
        let row = [];
        let cur = "";
        let inQuote = false;
        for (let char of lines[i]) {
          if (char === '"') inQuote = !inQuote;
          else if (char === ',' && !inQuote) { row.push(cur); cur = ""; }
          else cur += char;
        }
        row.push(cur);
        row = row.map(c => c.trim().replace(/^"|"$/g, ''));
        
        let teamData = { name: "", leader_name: "", leader_email: "", members: [] };
        
        headers.forEach((header, idx) => {
          if (!row[idx]) return;
          if (header.includes("team name") || header === "team") teamData.name = row[idx];
          else if (header.includes("leader name") || header === "leader") teamData.leader_name = row[idx];
          else if (header.includes("email") || header.includes("address")) teamData.leader_email = row[idx];
          else if (header.includes("member") || header.includes("teammate")) teamData.members.push(row[idx]);
        });
        
        if (teamData.name) {
          teams.push(teamData);
        }
      }
      
      try {
        const resData = await apiRequest("/teams/bulk", {
          method: "POST",
          token: localStorage.getItem("hcr_token"),
          body: { teams }
        });
        setMessage(resData.message || "Upload complete.");
        mutate();
      } catch (err) {
        setMessage(err.message);
      }
      setLoading(false);
      event.target.value = null; 
    };
    reader.readAsText(file);
  }

  return (
    <Panel title="Bulk upload teams" meta="Upload a Google Forms CSV">
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
          CSV must contain headers like: <strong>Team Name, Leader Name, Email Address, Member 1...</strong>
        </p>
        <input type="file" accept=".csv" onChange={handleFileUpload} disabled={loading} style={{ padding: "8px", border: "1px solid var(--border)", borderRadius: "4px" }} />
        {loading && <p>Uploading...</p>}
        {message && <p className={message.includes("Successfully") ? "success" : "alert"} style={{ margin: 0 }}>{message}</p>}
      </div>
    </Panel>
  );
}

function JudgePanel({ data, user, mutate, activeTab }) {
  const judge = data.judges.find((item) => item.id === user.id);
  const teams = data.teams.filter((team) => judge?.assignedTeamIds.includes(team.id));
  return (
    <div className="content-grid">
      <section className="left-column" style={{ minHeight: "60vh" }}>
        {activeTab === "Overview" && (
          <div className="alert info">Welcome Judge! You have {teams.length} teams assigned. Select 'Scoring' from the sidebar to review them.</div>
        )}
        {activeTab === "Schedule" && <SchedulePanel data={data} mutate={mutate} isAdmin={false} />}
        {activeTab === "Scoring" && (
          <Panel title="Assigned teams" meta={`${teams.length} teams`}>
            <div className="card-list">
              {teams.map((team) => <ScoreCard key={team.id} team={team} scores={data.scores} user={user} mutate={mutate} />)}
              {!teams.length && <Empty text="Admin has not assigned any teams yet." />}
            </div>
          </Panel>
        )}
        {activeTab === "Leaderboard" && <Leaderboard data={data} />}
      </section>
      {activeTab !== "Leaderboard" && (
        <aside className="right-column">
          <Leaderboard data={data} />
          <NoticeBoard announcements={data.announcements} />
        </aside>
      )}
    </div>
  );
}

function MentorPanel({ data, user, mutate, activeTab }) {
  const mentor = data.mentors.find((item) => item.id === user.id);
  const teams = data.teams.filter((team) => mentor?.assignedTeamIds.includes(team.id));
  return (
    <div className="content-grid">
      <section className="left-column" style={{ minHeight: "60vh" }}>
        {activeTab === "Overview" && (
          <div className="alert info">Welcome Mentor! You have {teams.length} teams assigned.</div>
        )}
        {activeTab === "Schedule" && <SchedulePanel data={data} mutate={mutate} isAdmin={false} />}
        {activeTab === "My Teams" && (
          <Panel title="Mentorship queue" meta={`${teams.length} teams`}>
            <div className="card-list">
              {teams.map((team) => <MentorTeamCard key={team.id} team={team} tasks={data.tasks} mutate={mutate} />)}
              {!teams.length && <Empty text="Admin has not assigned any teams yet." />}
            </div>
          </Panel>
        )}
        {activeTab === "Tasks" && (
          <Panel title="All Tasks">
            <div className="card-list">
              {data.tasks.map(task => <TeamTask key={task.id} task={task} mentors={data.mentors} mutate={mutate} />)}
            </div>
          </Panel>
        )}
      </section>
      <aside className="right-column">
        <NoticeBoard announcements={data.announcements} />
      </aside>
    </div>
  );
}

function TeamPanel({ data, user, mutate, activeTab }) {
  const team = findTeam(data, user.team_id);
  const scores = data.scores.filter((score) => score.team_id === user.team_id);
  const tasks = data.tasks.filter((task) => task.team_id === user.team_id);
  return (
    <div className="content-grid">
      <section className="left-column" style={{ minHeight: "60vh" }}>
        {team?.disqualified && <div className="danger-banner">Your team is currently disqualified. Please contact the event desk.</div>}

        {activeTab === "Overview" && (
          <MetricGrid data={{ ...data, teams: data.teams.filter(t => t.id === team?.id) }} />
        )}
        {activeTab === "Schedule" && <SchedulePanel data={data} mutate={mutate} isAdmin={false} />}
        {activeTab === "Feedback" && (
          <Panel title="Judge feedback" meta={`${scores.length} reviews`}>
            <div className="card-list">
              {scores.map((score) => {
                const judge = data.judges.find((item) => item.id === score.judge_id);
                return <InfoCard key={score.id} title={judge?.name || "Judge"} meta={`${score.points} points`} body={score.feedback} />;
              })}
              {!scores.length && <Empty text="No judge feedback yet." />}
            </div>
          </Panel>
        )}

        {activeTab === "Tasks" && (
          <Panel title="Mentor tasks" meta={`${tasks.length} tasks`}>
            <div className="card-list">
              {tasks.map((task) => <TeamTask key={task.id} task={task} mentors={data.mentors} mutate={mutate} />)}
              {!tasks.length && <Empty text="No mentor tasks yet." />}
            </div>
          </Panel>
        )}

        {activeTab === "Leaderboard" && <Leaderboard data={data} highlightTeamId={user.team_id} />}
      </section>
      {activeTab !== "Leaderboard" && (
        <aside className="right-column">
          <Leaderboard data={data} highlightTeamId={user.team_id} />
          <NoticeBoard announcements={data.announcements} />
        </aside>
      )}
    </div>
  );
}

function MetricGrid({ data }) {
  const disqualified = data.teams.filter((team) => team.disqualified).length;
  return (
    <div className="metric-grid">
      <div className="stat">
        <div className="stat-num">{data.teams.filter((team) => team.registered).length}</div>
        <div className="stat-label">Registered teams</div>
      </div>
      <div className="stat">
        <div className="stat-num">{data.judges.length}</div>
        <div className="stat-label">Judges</div>
      </div>
      <div className="stat">
        <div className="stat-num">{data.mentors.length}</div>
        <div className="stat-label">Mentors</div>
      </div>
      <div className="stat">
        <div className="stat-num danger">{disqualified}</div>
        <div className="stat-label">Disqualified</div>
      </div>
    </div>
  );
}

function AnnouncementForm({ mutate }) {
  const [form, setForm] = useState({ title: "", body: "" });
  async function submit(event) {
    event.preventDefault();
    await mutate("/announcements", { method: "POST", body: form });
    setForm({ title: "", body: "" });
  }
  return (
    <Panel title="Send announcement" meta="Visible to all dashboards">
      <form className="form-stack" onSubmit={submit}>
        <Input label="Title" value={form.title} onChange={(title) => setForm({ ...form, title })} />
        <label className="field">
          <span>Message</span>
          <textarea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} required />
        </label>
        <button className="btn primary" type="submit">Publish notice</button>
      </form>
    </Panel>
  );
}

function PeopleManager({ title, role, people, teams, mutate }) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await mutate("/people", { method: "POST", body: { ...form, role } });
      setForm({ name: "", email: "", password: "" });
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleAssignment(person, teamId, checked) {
    setError("");
    const teamIds = checked
      ? [...new Set([...person.assignedTeamIds, teamId])]
      : person.assignedTeamIds.filter((id) => id !== teamId);
    try {
      await mutate("/assignments", { method: "PATCH", body: { role, personId: person.id, teamIds } });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Panel title={title} meta={`${people.length} registered`}>
      {error && <div className="alert" style={{ marginBottom: "1rem" }}>{error}</div>}
      <form className="inline-form" onSubmit={submit}>
        <Input label="Name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
        <Input label="Email" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} />
        <Input label="Password" type="password" value={form.password} onChange={(password) => setForm({ ...form, password })} />
        <button className="btn primary" type="submit">Add {label(role)}</button>
      </form>
      <div className="card-list spacious">
        {people.map((person) => (
          <article className="assignment-card" key={person.id}>
            <div className="row-between">
              <div>
                <strong>{person.name}</strong>
                <small>{person.email}</small>
              </div>
              <span className="badge blue">{person.assignedTeamIds.length} assigned</span>
            </div>
            <div className="checkbox-grid">
              {teams.map((team) => (
                <label key={team.id} className="check-pill">
                  <input
                    type="checkbox"
                    checked={person.assignedTeamIds.includes(team.id)}
                    onChange={(event) => toggleAssignment(person, team.id, event.target.checked)}
                  />
                  <span>{team.name}</span>
                </label>
              ))}
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function TeamAdmin({ teams, mutate }) {
  return (
    <Panel title="Teams" meta={`${teams.length} total`}>
      <div className="team-grid">
        {teams.map((team) => (
          <article className="team-card" key={team.id}>
            <div>
              <strong>{team.name}</strong>
              <small>{team.registered ? `${team.members.length} members` : "Registration open"}</small>
            </div>
            <span className={`badge ${team.disqualified ? "red" : team.registered ? "green" : "amber"}`}>
              {team.disqualified ? "Disqualified" : team.registered ? "Registered" : "Open"}
            </span>
            <button
              className={team.disqualified ? "btn secondary" : "btn danger"}
              onClick={() => mutate(`/teams/${team.id}/disqualification`, { method: "PATCH", body: { disqualified: !team.disqualified } })}
            >
              {team.disqualified ? "Restore" : "Disqualify"}
            </button>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function ScoreCard({ team, scores, user, mutate }) {
  const existing = scores.find((score) => score.team_id === team.id && score.judge_id === user.id);
  const [form, setForm] = useState({ points: existing?.points || "", feedback: existing?.feedback || "" });

  async function submit(event) {
    event.preventDefault();
    await mutate("/scores", { method: "POST", body: { teamId: team.id, ...form } });
  }

  return (
    <article className="review-card">
      <div className="row-between">
        <div>
          <strong>{team.name}</strong>
          <small>{team.registered ? `${team.members.length} members` : "Not registered yet"}</small>
        </div>
        <span className={`badge ${team.disqualified ? "red" : "blue"}`}>{team.disqualified ? "DQ" : existing ? `${existing.points} pts` : "Not scored"}</span>
      </div>
      <form className="score-form" onSubmit={submit}>
        <Input label="Points" type="number" value={form.points} disabled={team.disqualified} onChange={(points) => setForm({ ...form, points })} />
        <label className="field">
          <span>Feedback</span>
          <textarea value={form.feedback} disabled={team.disqualified} onChange={(event) => setForm({ ...form, feedback: event.target.value })} required />
        </label>
        <button className="btn primary" type="submit" disabled={team.disqualified}>Save score</button>
      </form>
    </article>
  );
}

function MentorTeamCard({ team, tasks, mutate }) {
  const [form, setForm] = useState({ title: "", details: "" });
  const teamTasks = tasks.filter((task) => task.team_id === team.id);

  async function submit(event) {
    event.preventDefault();
    await mutate("/tasks", { method: "POST", body: { teamId: team.id, ...form } });
    setForm({ title: "", details: "" });
  }

  return (
    <article className="review-card">
      <div className="row-between">
        <div>
          <strong>{team.name}</strong>
          <small>{team.registered ? `${team.members.length} members` : "Not registered yet"}</small>
        </div>
        <span className={`badge ${team.disqualified ? "red" : "green"}`}>{team.disqualified ? "DQ" : `${teamTasks.length} tasks`}</span>
      </div>
      <form className="form-stack" onSubmit={submit}>
        <Input label="Task title" value={form.title} disabled={team.disqualified} onChange={(title) => setForm({ ...form, title })} />
        <label className="field">
          <span>Feedback or task details</span>
          <textarea value={form.details} disabled={team.disqualified} onChange={(event) => setForm({ ...form, details: event.target.value })} required />
        </label>
        <button className="btn primary" type="submit" disabled={team.disqualified}>Assign task</button>
      </form>
      <div className="mini-list">
        {teamTasks.map((task) => <InfoCard key={task.id} title={task.title} meta={task.status} body={task.details} />)}
      </div>
    </article>
  );
}

function TeamTask({ task, mentors, mutate }) {
  const mentor = mentors.find((item) => item.id === task.mentor_id);
  return (
    <article className="task-card">
      <div className="row-between">
        <div>
          <strong>{task.title}</strong>
          <small>Assigned by {mentor?.name || "Mentor"}</small>
        </div>
        <span className={`badge ${statusColor(task.status)}`}>{task.status}</span>
      </div>
      <p>{task.details}</p>
      <div className="segmented">
        {["pending", "working", "done"].map((status) => (
          <button
            key={status}
            className={task.status === status ? "selected" : ""}
            onClick={() => mutate(`/tasks/${task.id}/status`, { method: "PATCH", body: { status } })}
          >
            {label(status)}
          </button>
        ))}
      </div>
    </article>
  );
}

function Leaderboard({ data, highlightTeamId }) {
  const top3 = data.leaderboard.slice(0, 3);
  const maxScore = Math.max(...top3.map(t => t.total), 100); // Minimum scale of 100

  return (
    <Panel title="Leaderboard" meta={`${data.leaderboard.length} teams`}>
      {top3.length > 0 && (
        <div className="top3-graph">
          {top3.map((team, index) => {
            const height = Math.max((team.total / maxScore) * 100, 5); // at least 5% height
            return (
              <div key={team.id} className={`bar-container rank-${index + 1}`}>
                <div className="bar-wrapper">
                  <div className="bar" style={{ height: `${height}%` }}>
                    <span className="score">{team.total}</span>
                  </div>
                </div>
                <span className="team-name" title={team.name}>{team.name}</span>
                <span className="rank-badge">#{index + 1}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="leaderboard">
        <div className="table-head">
          <span>Rank</span>
          <span>Team</span>
          <span>Judges</span>
          <span>Points</span>
        </div>
        {data.leaderboard.map((team) => (
          <div key={team.id} className={`table-row ${team.id === highlightTeamId ? "highlight" : ""}`}>
            <span>{team.rank}</span>
            <strong>{team.name}</strong>
            <span>{team.judgedBy}</span>
            <span>{team.total}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function NoticeBoard({ announcements }) {
  return (
    <Panel title="Notice board" meta={`${announcements.length} notices`}>
      <div className="card-list">
        {announcements.map((item) => (
          <InfoCard key={item.id} title={item.title} body={item.body} meta={formatDate(item.created_at)} />
        ))}
      </div>
    </Panel>
  );
}

function Panel({ title, meta, children }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">{title}</h2>
        {meta && <span className="panel-tag">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function InfoCard({ title, meta, body }) {
  return (
    <article className="info-card">
      <div className="row-between">
        <strong>{title}</strong>
        {meta && <span className="tiny">{meta}</span>}
      </div>
      <p>{body}</p>
    </article>
  );
}

function Metric({ title, value }) {
  return (
    <article className="metric-card">
      <strong>{value}</strong>
      <span>{title}</span>
    </article>
  );
}

function Signal({ title, value }) {
  return (
    <article className="signal">
      <strong>{value}</strong>
      <span>{title}</span>
    </article>
  );
}

function Input({ label, value, onChange, type = "text", disabled = false, required = true }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} required={required} />
    </label>
  );
}

function Empty({ text }) {
  return <div className="empty">{text}</div>;
}

function findTeam(data, teamId) {
  return data.teams.find((team) => team.id === teamId);
}

function label(value) {
  return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1);
}

function statusColor(status) {
  if (status === "done") return "green";
  if (status === "working") return "blue";
  return "amber";
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function SchedulePanel({ data, mutate, isAdmin }) {
  const [form, setForm] = useState({ title: "", description: "", startTime: "", endTime: "" });

  async function submit(event) {
    event.preventDefault();
    await mutate("/schedule", { method: "POST", body: form });
    setForm({ title: "", description: "", startTime: "", endTime: "" });
  }

  async function deleteEvent(id) {
    if (confirm("Are you sure you want to delete this event?")) {
      await mutate(`/schedule/${id}`, { method: "DELETE" });
    }
  }

  const events = data.scheduleEvents || [];

  return (
    <Panel title="Schedule & Itinerary" meta={`${events.length} events`}>
      {isAdmin && (
        <form className="form-stack schedule-form" onSubmit={submit} style={{ marginBottom: "2rem", padding: "1rem", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }}>
          <h4>Add New Event</h4>
          <Input label="Event Title" value={form.title} onChange={(title) => setForm({ ...form, title })} required />
          <Input label="Description (Optional)" value={form.description} onChange={(description) => setForm({ ...form, description })} required={false} />
          <div style={{ display: "flex", gap: "1rem" }}>
            <Input label="Start Time" type="datetime-local" value={form.startTime} onChange={(startTime) => setForm({ ...form, startTime })} required />
            <Input label="End Time (Optional)" type="datetime-local" value={form.endTime} onChange={(endTime) => setForm({ ...form, endTime })} required={false} />
          </div>
          <button className="btn primary" type="submit">Add Event</button>
        </form>
      )}

      <div className="timeline">
        {events.map((event) => (
          <div key={event.id} className="timeline-item">
            <div className="timeline-marker"></div>
            <div className="timeline-content info-card">
              <div className="row-between">
                <strong>{event.title}</strong>
                {isAdmin && (
                  <button className="btn danger tiny-btn" onClick={() => deleteEvent(event.id)}>Delete</button>
                )}
              </div>
              <div className="timeline-time" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                <span>{formatDate(event.start_time)}</span>
                {event.end_time && <span> - {formatDate(event.end_time)}</span>}
              </div>
              {event.description && <p>{event.description}</p>}
            </div>
          </div>
        ))}
        {events.length === 0 && <Empty text="No schedule events yet." />}
      </div>
    </Panel>
  );
}

createRoot(document.getElementById("root")).render(<App />);
