import React, { useEffect, useState, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://localhost:5001/api" : "/api");
const roleTabs = ["admin", "judge", "mentor", "team"];
const emptyLogin = { email: "", password: "" };

/* ─── Scroll Reveal Hook ─── */
function useScrollReveal(options = {}) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.unobserve(el); } },
      { threshold: options.threshold || 0.12, rootMargin: options.rootMargin || "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, isVisible];
}

/* ─── ScrollReveal Wrapper ─── */
function ScrollReveal({ children, delay = 0, direction = "up", className = "", style = {} }) {
  const [ref, isVisible] = useScrollReveal();
  const transforms = {
    up: "translateY(40px)",
    down: "translateY(-40px)",
    left: "translateX(50px)",
    right: "translateX(-50px)",
    scale: "scale(0.92)"
  };
  return (
    <div
      ref={ref}
      className={`scroll-reveal ${isVisible ? "revealed" : ""} ${className}`}
      style={{
        ...style,
        "--sr-delay": `${delay}ms`,
        "--sr-transform": transforms[direction] || transforms.up,
      }}
    >
      {children}
    </div>
  );
}

/* ─── Space Particles Canvas ─── */
function SpaceParticles() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    let particles = [];
    let shootingStars = [];
    let lastShootingStar = 0;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    // Create floating particles
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.8 + 0.3,
        dx: (Math.random() - 0.5) * 0.15,
        dy: (Math.random() - 0.5) * 0.1 - 0.05,
        opacity: Math.random() * 0.6 + 0.2,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.02 + 0.005,
      });
    }

    function draw(time) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw floating particles
      for (const p of particles) {
        p.x += p.dx;
        p.y += p.dy;
        p.pulse += p.pulseSpeed;
        const glow = p.opacity * (0.6 + 0.4 * Math.sin(p.pulse));

        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;
        if (p.y < -10) p.y = canvas.height + 10;
        if (p.y > canvas.height + 10) p.y = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(242, 165, 61, ${glow * 0.4})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${glow})`;
        ctx.fill();
      }

      // Shooting stars
      if (time - lastShootingStar > 4000 + Math.random() * 6000) {
        lastShootingStar = time;
        shootingStars.push({
          x: Math.random() * canvas.width * 0.8,
          y: Math.random() * canvas.height * 0.3,
          len: 60 + Math.random() * 100,
          speed: 6 + Math.random() * 6,
          angle: Math.PI / 5 + Math.random() * 0.3,
          life: 1,
          decay: 0.012 + Math.random() * 0.008,
        });
      }

      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i];
        s.x += Math.cos(s.angle) * s.speed;
        s.y += Math.sin(s.angle) * s.speed;
        s.life -= s.decay;

        if (s.life <= 0) { shootingStars.splice(i, 1); continue; }

        const tailX = s.x - Math.cos(s.angle) * s.len;
        const tailY = s.y - Math.sin(s.angle) * s.len;

        const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
        grad.addColorStop(0, `rgba(242, 165, 61, 0)`);
        grad.addColorStop(0.7, `rgba(255, 200, 100, ${s.life * 0.5})`);
        grad.addColorStop(1, `rgba(255, 255, 255, ${s.life})`);

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(s.x, s.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Head glow
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${s.life})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="space-particles" />;
}

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
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handler = (event) => {
        if (event.data && event.data.type === 'PUSH_NOTIFICATION') {
          setToast(event.data.data);
          setTimeout(() => setToast(null), 8000);
          if (token) {
            apiRequest("/dashboard", { token }).then(payload => {
              setData(payload);
              if (payload.user) setUser(payload.user);
            }).catch(err => console.warn("Push refresh error:", err));
          }
        }
      };
      navigator.serviceWorker.addEventListener('message', handler);
      return () => navigator.serviceWorker.removeEventListener('message', handler);
    }
  }, [token]);

  useEffect(() => {
    setActiveTab("Overview");
  }, [user?.role]);

  useEffect(() => {
    if (!token) return;
    const isPowerUser = user?.role === "admin" || user?.role === "mentor";
    const intervalTime = isPowerUser ? 3000 : 10000;
    const interval = setInterval(() => {
      apiRequest("/dashboard", { token }).then(payload => {
        setData(payload);
        if (payload.user) setUser(payload.user);
      }).catch(err => console.warn("Polling error:", err));
    }, intervalTime);
    return () => clearInterval(interval);
  }, [token, user?.role]);

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

  async function subscribeToWebPush(token, showSuccessAlert = false) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      if (showSuccessAlert) alert('Push notifications are not supported in your browser.');
      return;
    }
    try {
      const sw = await navigator.serviceWorker.register('/sw.js');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        if (showSuccessAlert) alert('Notification permission was denied.');
        return;
      }
      
      const response = await fetch(`${API_BASE}/vapid_public_key`);
      const { publicKey } = await response.json();
      
      const padding = '='.repeat((4 - publicKey.length % 4) % 4);
      const base64 = (publicKey + padding).replace(/\-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
      
      let subscription = await sw.pushManager.getSubscription();
      if (!subscription) {
        subscription = await sw.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: outputArray
        });
      }
      
      const subRes = await fetch(`${API_BASE}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(subscription)
      });
      
      if (!subRes.ok) {
        const errData = await subRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save subscription on server.');
      }
      
      if (showSuccessAlert) alert('Notifications Enabled Successfully!');
    } catch (e) {
      console.log('Push setup failed', e);
      if (showSuccessAlert) alert('Push setup failed: ' + e.message);
    }
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
    subscribeToWebPush(payload.token);
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
    <DashboardShell user={user} data={data} onLogout={logout} onSubscribe={() => subscribeToWebPush(token, true)} activeTab={activeTab} setActiveTab={setActiveTab}>
      {toast && (
        <div className="toast-container">
          <div className="toast">
            <div className="toast-header">
              <span className="toast-title">{toast.title}</span>
              <button className="toast-close" onClick={() => setToast(null)}>&times;</button>
            </div>
            <div className="toast-body">{toast.body}</div>
          </div>
        </div>
      )}
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
      <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '15px', color: 'var(--muted)', letterSpacing: '.5px' }}>Initializing dashboard...</p>
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

  const roleIcons = { admin: "⚙️", judge: "⚖️", mentor: "🧭", team: "👥" };

  return (
    <main className="auth-layout">
      <section className="auth-visual">
        <div>
          <div className="brand-chip">✦ APRATIM SRIJAN KUMBH</div>
          <h1>Where Innovation<br/>Meets Execution</h1>
          <p className="auth-hero-sub">The unified command center for teams, judges, mentors — all in one seamless experience.</p>
        </div>
        <div className="signal-grid">
          <div className="signal"><strong>24h</strong><span>Non-stop hacking</span></div>
          <div className="signal"><strong>Live</strong><span>Real-time scoring</span></div>
          <div className="signal"><strong>∞</strong><span>Unlimited potential</span></div>
        </div>
        <div className="auth-footer-bar">
          <span>🔒 Encrypted</span>
          <span>⚡ Real-time</span>
          <span>📱 Mobile-ready</span>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="section-title">
            <span className="section-eyebrow">{adminConfigured ? "Secure Access" : "First-time Setup"}</span>
            <h2>{adminConfigured ? `${label(role)} Login` : "Create Admin Account"}</h2>
          </div>
          {adminConfigured && (
            <div className="role-tabs">
              {roleTabs.map((item) => (
                <button key={item} className={role === item ? "active" : ""} onClick={() => setRole(item)}>
                  <span className="role-icon">{roleIcons[item]}</span> {label(item)}
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
                <button className="btn primary" type="submit">Sign in →</button>
              </form>
              {role === "team" && (
                <div className="auth-actions">
                  <button className="link-btn" type="button" onClick={() => setAuthMode("forgot")}>Forgot password?</button>
                </div>
              )}
              {role === "team" && (
                <>
                  <div className="auth-divider"><span>or register your team</span></div>
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
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (role === "team") {
      apiRequest("/public/registered-teams")
        .then((payload) => setTeams(payload.teams))
        .catch(() => setTeams([]));
    }
  }, [role]);

  async function submit(event) {
    event.preventDefault();
    try {
      const payload = await onForgotPassword({ role, email, teamId, password });
      setMessage(payload.message);
      setPassword("");
      setTeamId("");
      setEmail("");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      {message && <div className="success">{message}</div>}
      
      {role === "team" ? (
        <label className="field">
          <span>Choose team</span>
          <select value={teamId} onChange={(event) => setTeamId(event.target.value)} required>
            <option value="">Select registered team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
      ) : (
        <Input label={`${label(role)} email`} type="email" value={email} onChange={setEmail} required />
      )}

      <Input label="New password" type="password" value={password} onChange={setPassword} required />
      <button className="btn primary" type="submit">Reset Password</button>
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

function DashboardShell({ user, data, onLogout, onSubscribe, children, activeTab, setActiveTab }) {
  const subtitle = {
    admin: "Command center — manage teams, judges, mentors, scores, and everything in between.",
    judge: "Review and score teams assigned to you by the admin.",
    mentor: "Guide your teams, assign tasks, and track their progress.",
    team: "Stay updated with scores, tasks, announcements, and your ranking."
  }[user.role];

  const tabs = {
    admin: ["Overview", "Schedule", "Judges", "Mentors", "Teams", "Announcements", "Help Queue", "Leaderboard"],
    judge: ["Overview", "Schedule", "Scoring", "Leaderboard"],
    mentor: ["Overview", "Schedule", "My Teams", "Tasks"],
    team: ["Overview", "Schedule", "Feedback", "Tasks", "Help", "Leaderboard"]
  }[user.role];

  const tabIcons = {
    "Overview": "◎", "Schedule": "◷", "Judges": "⚖", "Mentors": "◈",
    "Teams": "◫", "Announcements": "◆", "Help Queue": "◉", "Leaderboard": "▲",
    "Scoring": "✦", "My Teams": "◫", "Tasks": "☐", "Feedback": "◇", "Help": "◉"
  };

  const greetings = {
    admin: "Admin Dashboard",
    judge: "Judge Dashboard",
    mentor: "Mentor Dashboard",
    team: findTeam(data, user.team_id)?.name || "Team Dashboard"
  };

  return (
    <div className="layout">
      <div className="stars"></div>
      <SpaceParticles />
      <div className="scene">
        <div className="nebula"></div>
        <div className="petrova-arc"></div>
        <div className="dying-sun"></div>
      </div>
      <div className="sun-corner"></div>

      <aside className="sidebar">
        <div className="brand">
          <img src="/hackathon-logo.png" alt="Logo" className="brand-logo-img" />
          <div>
            <div className="brand-name">Apratim Srijan Kumbh</div>
            <div className="brand-sub">Hackathon Control</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {tabs.map((tab) => (
            <a
              key={tab}
              className={activeTab === tab ? "active" : ""}
              onClick={() => setActiveTab(tab)}
            >
              <span className="nav-icon">{tabIcons[tab] || "◦"}</span>
              {tab}
            </a>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="admin-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div className="user-avatar">{user.name?.charAt(0)?.toUpperCase()}</div>
              <div>
                <div className="admin-name">{user.name}</div>
                <div className="admin-email">{user.email}</div>
              </div>
            </div>
            <span className="admin-badge">{label(user.role)}</span>
          </div>
          <button className="logout-btn" onClick={onLogout} style={{ marginBottom: "8px" }}>↪ Sign Out</button>
          <button className="logout-btn" onClick={onSubscribe}>🔔 Enable Notifications</button>
        </div>
      </aside>

      <main className="workspace">
        <ScrollReveal delay={0} direction="down">
          <div className="eyebrow">✦ {label(user.role)} Workspace</div>
          <div className="head-row">
            <div>
              <h1>{greetings[user.role]}</h1>
              <p className="subtitle">{subtitle}</p>
              {user.role === "team" && findTeam(data, user.team_id)?.domain && (
                <span className="badge blue" style={{ marginTop: '10px', display: 'inline-block', marginRight: '8px' }}>
                  {findTeam(data, user.team_id)?.domain}
                </span>
              )}
              {user.role === "team" && findTeam(data, user.team_id)?.venue && (
                <span className="badge green" style={{ marginTop: '10px', display: 'inline-block' }}>
                  Venue: {findTeam(data, user.team_id)?.venue}
                </span>
              )}
            </div>
            <div className="brand-logo-container">
              <img src="/iist-logo.png" alt="IIST Logo" className="iist-logo" />
            </div>
          </div>
        </ScrollReveal>

        <div className="petrova">
          <span className="petrova-label">live · connected</span>
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
          {activeTab === "Overview" && (
            <>
              <MetricGrid data={data} />
              <NoticeBoard announcements={data.announcements} />
            </>
          )}
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
          {activeTab === "Help Queue" && <HelpQueue data={data} mutate={mutate} />}
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
            {activeTab !== "Announcements" && activeTab !== "Overview" && <NoticeBoard announcements={data.announcements} />}
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
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (!rows || rows.length === 0) {
          setMessage("File is empty or missing data.");
          setLoading(false);
          return;
        }

        const teams = [];
        for (let row of rows) {
          let teamData = { name: "", leader_name: "", leader_email: "", domain: "", members: [] };
          for (const [key, val] of Object.entries(row)) {
            const header = key.toLowerCase().replace(/[^a-z0-9]/g, '');
            const strVal = String(val).trim();
            if (!strVal) continue;

            if (header.includes("teamname") || (header.includes("team") && header.includes("name") && !header.includes("leader") && !header.includes("teammate"))) teamData.name = strVal;
            else if (header.includes("leader") && header.includes("name")) teamData.leader_name = strVal;
            else if (header.includes("leader") && (header.includes("email") || header.includes("mail"))) teamData.leader_email = strVal;
            else if (header.includes("email") && !teamData.leader_email) teamData.leader_email = strVal; // Fallback to submitter email
            else if (header.includes("domain") || header.includes("theme") || header.includes("track")) teamData.domain = strVal;
            else if ((header.includes("teammate") || header.includes("member")) && header.includes("name")) teamData.members.push(strVal);
          }

          if (teamData.name) {
            // Include leader in members array if missing
            if (teamData.leader_name && !teamData.members.includes(teamData.leader_name)) {
              teamData.members.unshift(teamData.leader_name);
            }
            teams.push(teamData);
          }
        }
      
        const resData = await apiRequest("/teams/bulk", {
          method: "POST",
          token: localStorage.getItem("hcr_token"),
          body: { teams }
        });
        setMessage(resData.message || "Upload complete.");
        mutate();
      } catch (err) {
        setMessage(err.message || "Error reading Excel file.");
      }
      setLoading(false);
      event.target.value = null; 
    };
    reader.readAsArrayBuffer(file);
  }

  return (
    <Panel title="Bulk upload teams" meta="Upload the Excel file directly">
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
          Excel must contain headers like: <strong>Team Name, Leader Name, Email Address, Member 1...</strong>
        </p>
        <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} disabled={loading} style={{ padding: "8px", border: "1px solid var(--border)", borderRadius: "4px" }} />
        {loading && <p>Uploading...</p>}
        {message && <p className={message.includes("Successfully") ? "success" : "alert"} style={{ margin: 0 }}>{message}</p>}
      </div>
    </Panel>
  );
}

function JudgePanel({ data, user, mutate, activeTab }) {
  const judge = data.judges.find((item) => item.id === user.id);
  const teams = data.teams.filter((team) => judge?.assignedTeamIds.includes(team.id));
  const [activeScoreTeam, setActiveScoreTeam] = useState(null);

  return (
    <div className="content-grid">
      <section className="left-column" style={{ minHeight: "60vh" }}>
        {activeTab === "Overview" && (
          <>
            <div className="alert info" style={{ marginBottom: '16px' }}>Welcome Judge! You have {teams.length} teams assigned. Select 'Scoring' from the sidebar to review them.</div>
            <NoticeBoard announcements={data.announcements} />
          </>
        )}
        {activeTab === "Schedule" && <SchedulePanel data={data} mutate={mutate} isAdmin={false} />}
        {activeTab === "Scoring" && (
          <Panel title="Assigned teams" meta={`${teams.length} teams`}>
            <div className="team-grid">
              {teams.map((team) => {
                const score = data.scores.find((s) => s.team_id === team.id && s.judge_id === user.id);
                return (
                  <article 
                    className="team-card" 
                    key={team.id} 
                    style={{ cursor: 'pointer', minHeight: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }} 
                    onClick={() => setActiveScoreTeam(team)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <div>
                        <strong style={{ fontSize: '15px' }}>{team.name}</strong>
                        <div style={{ marginTop: '4px' }}>
                          <span className="badge blue" style={{ fontSize: '11px', padding: '2px 8px' }}>
                            📍 {team.venue || "No Venue"}
                          </span>
                        </div>
                      </div>
                      <span className={`badge ${score ? "green" : "amber"}`}>
                        {score ? `${score.points} pts` : "Not scored"}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
            {!teams.length && <Empty text="Admin has not assigned any teams yet." />}
          </Panel>
        )}
        {activeTab === "Leaderboard" && <Leaderboard data={data} />}
      </section>
      {activeTab !== "Leaderboard" && (
        <aside className="right-column">
          <Leaderboard data={data} />
          {activeTab !== "Overview" && <NoticeBoard announcements={data.announcements} />}
        </aside>
      )}
      {activeScoreTeam && (
        <ScoreModal 
          team={activeScoreTeam} 
          scores={data.scores} 
          user={user} 
          mutate={mutate} 
          onClose={() => setActiveScoreTeam(null)} 
        />
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
          <>
            <div className="alert info" style={{ marginBottom: '16px' }}>Welcome Mentor! You have {teams.length} teams assigned.</div>
            <NoticeBoard announcements={data.announcements} />
          </>
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
              {data.tasks.map(task => <TeamTask key={task.id} task={task} mentors={data.mentors} teams={data.teams} mutate={mutate} />)}
            </div>
          </Panel>
        )}
      </section>
      <aside className="right-column">
        {activeTab !== "Overview" && <NoticeBoard announcements={data.announcements} />}
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
          <>
            {team?.member_names && team.member_names.length > 0 && (
              <Panel title="Team Members" meta={team.domain || "No domain set"}>
                <div className="pill-row" style={{ flexWrap: 'wrap', gap: '8px' }}>
                  {team.member_names.map((name, i) => (
                    <span key={i} className="pill" style={{ padding: '4px 12px', fontSize: '14px' }}>{name}</span>
                  ))}
                </div>
              </Panel>
            )}
            <MetricGrid data={{ ...data, teams: data.teams.filter(t => t.id === team?.id) }} />
            <NoticeBoard announcements={data.announcements} />
          </>
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
              {tasks.map((task) => <TeamTask key={task.id} task={task} mentors={data.mentors} teams={data.teams} mutate={mutate} />)}
              {!tasks.length && <Empty text="No mentor tasks yet." />}
            </div>
          </Panel>
        )}

        {activeTab === "Help" && <TeamHelpSection data={data} mutate={mutate} teamId={user.team_id} />}

        {activeTab === "Leaderboard" && <Leaderboard data={data} highlightTeamId={user.team_id} />}
      </section>
      {activeTab !== "Leaderboard" && (
        <aside className="right-column">
          <Leaderboard data={data} highlightTeamId={user.team_id} />
          {activeTab !== "Overview" && <NoticeBoard announcements={data.announcements} />}
        </aside>
      )}
    </div>
  );
}

function MetricGrid({ data }) {
  const disqualified = data.teams.filter((team) => team.disqualified).length;
  const metrics = [
    { value: data.teams.filter((t) => t.registered).length, label: "Teams Registered", icon: "👥", accent: "var(--amber)" },
    { value: data.judges.length, label: "Active Judges", icon: "⚖️", accent: "var(--ice)" },
    { value: data.mentors.length, label: "Mentors", icon: "🧭", accent: "var(--emerald, #68d391)" },
    { value: disqualified, label: "Disqualified", icon: "⚠️", accent: "var(--danger)", isDanger: true },
  ];
  return (
    <div className="metric-grid">
      {metrics.map((m, i) => (
        <ScrollReveal key={m.label} delay={i * 80}>
          <div className="stat" style={{ '--stat-accent': m.accent }}>
            <div className="stat-icon">{m.icon}</div>
            <div className={`stat-num${m.isDanger ? ' danger' : ''}`}>{m.value}</div>
            <div className="stat-label">{m.label}</div>
            <div className="stat-accent-line" />
          </div>
        </ScrollReveal>
      ))}
    </div>
  );
}

function AnnouncementForm({ mutate }) {
  const [form, setForm] = useState({ title: "", body: "" });
  async function submit(event) {
    event.preventDefault();
    try {
      await mutate("/announcements", { method: "POST", body: form });
      setForm({ title: "", body: "" });
    } catch (e) {
      alert("Failed to publish announcement: " + e.message);
    }
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
      await mutate("/assignments", { method: "POST", body: { role, personId: person.id, teamIds } });
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
            <div className="row-between" style={{ marginBottom: "8px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <strong style={{ fontSize: "16px", color: "var(--text)" }}>{person.name}</strong>
                <small style={{ color: "var(--muted)", fontSize: "12px", fontFamily: "var(--hud-font)" }}>{person.email}</small>
              </div>
              <span className="badge blue">{person.assignedTeamIds.length} assigned</span>
            </div>
            <TeamAssigner person={person} teams={teams} onToggle={toggleAssignment} />
          </article>
        ))}
      </div>
    </Panel>
  );
}

function TeamAssigner({ person, teams, onToggle }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredTeams = teams.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));
  const assignedTeams = teams.filter((t) => person.assignedTeamIds.includes(t.id));

  return (
    <div className="team-assigner">
      <div className="assigned-chips">
        {assignedTeams.map((t) => (
          <span key={t.id} className="badge blue">
            {t.name}
            <button className="chip-remove" type="button" onClick={() => onToggle(person, t.id, false)}>&times;</button>
          </span>
        ))}
        <button className="btn secondary tiny-btn" type="button" onClick={() => setOpen(!open)}>
          {open ? "Close dropdown" : "+ Assign team"}
        </button>
      </div>
      
      {open && (
        <div className="dropdown-panel">
          <input
            type="text"
            placeholder="Search teams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="dropdown-list">
            {filteredTeams.map((team) => (
              <label key={team.id} className="check-pill">
                <input
                  type="checkbox"
                  checked={person.assignedTeamIds.includes(team.id)}
                  onChange={(e) => onToggle(person, team.id, e.target.checked)}
                />
                <span>{team.name}</span>
              </label>
            ))}
            {filteredTeams.length === 0 && <div className="empty" style={{ minHeight: '60px' }}>No teams found</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function TeamAdmin({ teams, mutate }) {
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedVenue, setSelectedVenue] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 20;

  const venues = Array.from(new Set(teams.map(t => t.venue).filter(Boolean))).sort();

  const filteredTeams = teams.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) || 
      (t.domain && t.domain.toLowerCase().includes(search.toLowerCase())) ||
      (t.leaderEmail && t.leaderEmail.toLowerCase().includes(search.toLowerCase())) ||
      (t.venue && t.venue.toLowerCase().includes(search.toLowerCase()));
    const matchesVenue = !selectedVenue || t.venue === selectedVenue;
    return matchesSearch && matchesVenue;
  });
  const totalPages = Math.max(1, Math.ceil(filteredTeams.length / itemsPerPage));
  const paginatedTeams = filteredTeams.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  // Reset page when search or venue changes
  React.useEffect(() => {
    setPage(1);
  }, [search, selectedVenue]);

  return (
    <>
      <Panel title="Teams" meta={`${filteredTeams.length} total`}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: "16px", flexWrap: 'wrap' }}>
          <input 
            type="text" 
            placeholder="Search teams by name, email, or domain..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            style={{ flex: 1, minWidth: '200px' }} 
          />
          <select
            value={selectedVenue}
            onChange={e => setSelectedVenue(e.target.value)}
            className="venue-select"
          >
            <option value="">All Venues</option>
            {venues.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
        <div className="team-grid">
          {paginatedTeams.map((team) => (
            <article className="team-card" key={team.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedTeam(team)}>
              <div>
                <strong style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {team.name}
                  {team.venue && <span className="badge blue" style={{ fontSize: '10px', padding: '2px 6px' }}>{team.venue}</span>}
                </strong>
                <small>{team.registered ? `${team.members.length} members (Registered)` : (team.member_names?.length ? `${team.member_names.length} members (CSV)` : "No members")}</small>
              </div>
              <span className={`badge ${team.disqualified ? "red" : team.registered ? "green" : "amber"}`}>
                {team.disqualified ? "Disqualified" : team.registered ? "Registered" : "Open"}
              </span>
              <button
                className={team.disqualified ? "btn secondary" : "btn danger"}
                onClick={(e) => { e.stopPropagation(); mutate(`/teams/${team.id}/disqualification`, { method: "POST", body: { disqualified: !team.disqualified } }); }}
              >
                {team.disqualified ? "Restore" : "Disqualify"}
              </button>
            </article>
          ))}
        </div>
        
        {totalPages > 1 && (
          <div style={{ display: "flex", gap: "8px", marginTop: "24px", justifyContent: "center", alignItems: "center" }}>
            <button className="btn secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span style={{ fontSize: "14px" }}>Page {page} of {totalPages}</span>
            <button className="btn secondary" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        )}
      </Panel>

      {selectedTeam && (
        <div className="modal-overlay" onClick={() => setSelectedTeam(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="panel" style={{ minWidth: '400px', maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0 }}>{selectedTeam.name}</h3>
                <span className="meta">{selectedTeam.domain || "No Domain"}</span>
              </div>
              <button className="btn secondary" onClick={() => setSelectedTeam(null)}>&times;</button>
            </div>
            <div style={{ marginTop: '16px' }}>
              <p><strong>Venue:</strong> {selectedTeam.venue || "No Venue"}</p>
              <p><strong>Leader Email:</strong> {selectedTeam.leaderEmail}</p>
              <p><strong>Status:</strong> {selectedTeam.registered ? "Registered" : "Open"}</p>
              
              <h4 style={{ marginTop: '16px', marginBottom: '8px' }}>Members</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedTeam.member_names && selectedTeam.member_names.length > 0 ? (
                  selectedTeam.member_names.map((m, i) => (
                    <li key={i} style={{ padding: '8px', backgroundColor: 'var(--bg)', borderRadius: '4px', border: '1px solid var(--border)' }}>{m}</li>
                  ))
                ) : (
                  <li style={{ color: 'var(--muted)' }}>No members found in CSV.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ScoreCard({ team, scores, user, mutate }) {
  return null;
}

function ScoreModal({ team, scores, user, mutate, onClose }) {
  const existing = scores.find((score) => score.team_id === team.id && score.judge_id === user.id);
  const [form, setForm] = useState({
    idea: existing?.idea_score !== undefined ? existing.idea_score : "",
    tech: existing?.tech_score !== undefined ? existing.tech_score : "",
    prototype: existing?.prototype_score !== undefined ? existing.prototype_score : "",
    business: existing?.business_score !== undefined ? existing.business_score : "",
    presentation: existing?.presentation_score !== undefined ? existing.presentation_score : "",
    feedback: existing?.feedback || ""
  });

  const scores_array = [Number(form.idea), Number(form.tech), Number(form.prototype), Number(form.business), Number(form.presentation)].filter(val => !isNaN(val) && val >= 0 && val <= 10);
  const avg = scores_array.length === 5 ? (scores_array.reduce((a, b) => a + b, 0) / 5).toFixed(2) : "0.00";

  async function submit(event) {
    event.preventDefault();
    await mutate("/scores", {
      method: "POST",
      body: {
        teamId: team.id,
        idea: Number(form.idea),
        tech: Number(form.tech),
        prototype: Number(form.prototype),
        business: Number(form.business),
        presentation: Number(form.presentation),
        feedback: form.feedback
      }
    });
    onClose();
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '40px 20px', overflowY: 'auto', backdropFilter: 'blur(8px)' }}>
      <div className="panel" style={{ width: '480px', maxWidth: '95vw', boxShadow: '0 20px 50px rgba(0,0,0,0.6)', border: '1px solid var(--border)', margin: '0 auto' }} onClick={e => e.stopPropagation()}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '20px' }}>Score Team: {team.name}</h3>
            <span className="meta" style={{ fontSize: '13px', display: 'block', marginTop: '4px' }}>📍 {team.venue || "No Venue"}</span>
          </div>
          <button className="btn secondary" onClick={onClose} style={{ minHeight: '36px', padding: '0 12px', fontSize: '20px' }}>&times;</button>
        </div>
        
        <form className="form-stack" onSubmit={submit} style={{ marginTop: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <label className="field">
              <span>Idea & Innovation (0-10)</span>
              <input type="number" min="0" max="10" required value={form.idea} onChange={e => setForm({ ...form, idea: e.target.value })} style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text)', outline: 'none' }} />
            </label>
            <label className="field">
              <span>Technical Execution (0-10)</span>
              <input type="number" min="0" max="10" required value={form.tech} onChange={e => setForm({ ...form, tech: e.target.value })} style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text)', outline: 'none' }} />
            </label>
            <label className="field">
              <span>Prototype/MVP (0-10)</span>
              <input type="number" min="0" max="10" required value={form.prototype} onChange={e => setForm({ ...form, prototype: e.target.value })} style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text)', outline: 'none' }} />
            </label>
            <label className="field">
              <span>Business Approach (0-10)</span>
              <input type="number" min="0" max="10" required value={form.business} onChange={e => setForm({ ...form, business: e.target.value })} style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text)', outline: 'none' }} />
            </label>
          </div>
          <div style={{ marginTop: '10px' }}>
            <label className="field">
              <span>Presentation & Pitch (0-10)</span>
              <input type="number" min="0" max="10" required value={form.presentation} onChange={e => setForm({ ...form, presentation: e.target.value })} style={{ width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text)', outline: 'none' }} />
            </label>
          </div>

          <div style={{ margin: '20px 0', padding: '14px', background: 'rgba(246,173,85,0.08)', border: '1px solid rgba(246,173,85,0.2)', borderRadius: '6px', textAlign: 'center' }}>
            <strong style={{ fontSize: '16px', color: 'var(--text)' }}>Average Score: <span style={{ color: 'var(--amber)', fontSize: '20px', marginLeft: '6px' }}>{avg} / 10</span></strong>
          </div>

          <label className="field">
            <span>Feedback & Suggestions</span>
            <textarea value={form.feedback} onChange={(event) => setForm({ ...form, feedback: event.target.value })} required style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text)', minHeight: '90px', outline: 'none', resize: 'vertical' }} />
          </label>

          <div style={{ display: 'flex', gap: '14px', marginTop: '24px' }}>
            <button className="btn primary" style={{ flex: 1 }} type="submit" disabled={team.disqualified}>Submit Score</button>
            <button className="btn secondary" type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
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
          <strong style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {team.name}
            {team.venue && <span className="badge green" style={{ fontSize: '11px', padding: '2px 8px' }}>{team.venue}</span>}
          </strong>
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

function TeamTask({ task, mentors, teams = [], mutate }) {
  const mentor = mentors.find((item) => item.id === task.mentor_id);
  const team = teams.find((item) => item.id === task.team_id);
  return (
    <article className="task-card">
      <div className="row-between">
        <div>
          <strong style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {task.title}
            {team && <span className="badge blue" style={{ fontSize: '10px', padding: '2px 6px' }}>{team.name}</span>}
            {team?.venue && <span className="badge green" style={{ fontSize: '10px', padding: '2px 6px' }}>{team.venue}</span>}
          </strong>
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
            onClick={() => mutate(`/tasks/${task.id}/status`, { method: "POST", body: { status } })}
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
        {data.leaderboard.slice(0, 10).map((team) => (
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
  const [page, setPage] = useState(0);
  const itemsPerPage = 3;
  const totalPages = Math.ceil(announcements.length / itemsPerPage);
  
  const currentItems = announcements.slice(page * itemsPerPage, (page + 1) * itemsPerPage);

  return (
    <Panel title="Notice board" meta={`${announcements.length} notices`}>
      <div className="card-list">
        {currentItems.map((item) => (
          <InfoCard key={item.id} title={item.title} body={item.body} meta={formatDate(item.created_at)} />
        ))}
        {announcements.length === 0 && <Empty text="No announcements yet." />}
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', alignItems: 'center' }}>
          <button 
            className="btn secondary tiny-btn" 
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Previous
          </button>
          <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Page {page + 1} of {totalPages}</span>
          <button 
            className="btn secondary tiny-btn" 
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
          >
            Next
          </button>
        </div>
      )}
    </Panel>
  );
}

function Panel({ title, meta, children }) {
  return (
    <ScrollReveal>
      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">{title}</h2>
          {meta && <span className="panel-tag">{meta}</span>}
        </div>
        {children}
      </section>
    </ScrollReveal>
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

function HelpQueue({ data, mutate }) {
  const pendingRequests = data.helpRequests?.filter((req) => req.status === "pending") || [];
  
  async function resolveRequest(id) {
    await mutate(`/help-requests/${id}`, { method: "PATCH" });
  }

  return (
    <Panel title="Help Queue" meta={`${pendingRequests.length} pending`}>
      <div className="card-list">
        {pendingRequests.map((req) => {
          const team = findTeam(data, req.team_id);
          return (
            <div key={req.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
              <div>
                <div className="card-title">{team?.name || "Unknown Team"} (Location: {req.location})</div>
                <div className="card-sub" style={{ marginTop: "4px" }}>{req.description}</div>
                <div className="card-sub" style={{ fontSize: "12px", marginTop: "4px", opacity: 0.7 }}>Requested at: {new Date(req.created_at).toLocaleTimeString()}</div>
              </div>
              <button className="btn primary" onClick={() => resolveRequest(req.id)}>Resolve</button>
            </div>
          );
        })}
        {pendingRequests.length === 0 && <Empty text="No pending help requests. Good job!" />}
      </div>
    </Panel>
  );
}

function TeamHelpSection({ data, mutate, teamId }) {
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const pendingRequest = data.helpRequests?.find((req) => req.team_id === teamId && req.status === "pending");

  async function submitRequest(e) {
    e.preventDefault();
    if (!location) return alert("Location is required.");
    setLoading(true);
    await mutate("/help-requests", { method: "POST", body: { location, description } });
    setLocation("");
    setDescription("");
    setLoading(false);
  }

  if (pendingRequest) {
    return (
      <Panel title="Help Request Active" meta="Pending">
        <div className="alert info">
          <strong>Help is on the way!</strong>
          <p style={{ marginTop: "8px" }}>You requested help at <strong>{pendingRequest.location}</strong>: {pendingRequest.description}</p>
          <p style={{ marginTop: "8px", opacity: 0.8, fontSize: "0.9em" }}>Please wait for a mentor or volunteer to arrive.</p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Request Help">
      <form onSubmit={submitRequest} className="data-form">
        <div className="form-group">
          <label>Your Location (e.g., Table 5, Room 101) <span className="req">*</span></label>
          <input type="text" value={location} onChange={e => setLocation(e.target.value)} required placeholder="Where are you seated?" />
        </div>
        <div className="form-group">
          <label>What do you need help with?</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows="3" placeholder="Briefly describe the issue..." />
        </div>
        <button type="submit" className="btn primary" disabled={loading} style={{ width: "100%" }}>
          {loading ? "Submitting..." : "Call for Help"}
        </button>
      </form>
    </Panel>
  );
}

createRoot(document.getElementById("root")).render(<App />);
