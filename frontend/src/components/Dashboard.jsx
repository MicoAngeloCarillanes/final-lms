/**
 * Dashboard.jsx — Home dashboard for Admin, Teacher, Student
 * Shows: announcements feed, mini calendar, task list
 *
 * FOLDER: src/components/Dashboard.jsx
 *
 * Props: { user, courses, enrollments }
 */
import React, { useState, useEffect, useRef } from "react";
import { announcementApi, taskApi } from "../lib/api";
import { Btn, Input, Badge, Toast } from "./ui";
import TopBar from "./TopBar";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const CAT_META = {
  General:  { color: "#60a5fa", bg: "rgba(59,130,246,.15)"  },
  Academic: { color: "#a5b4fc", bg: "rgba(99,102,241,.15)"  },
  Events:   { color: "#34d399", bg: "rgba(16,185,129,.15)"  },
  Urgent:   { color: "#f87171", bg: "rgba(239,68,68,.15)"   },
};

const TASK_COLORS = {
  Task:       "#60a5fa",
  Assignment: "#fbbf24",
  Exam:       "#f87171",
  Reminder:   "#a5b4fc",
};

function timeAgo(ts) {
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 60)   return "just now";
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return `${MONTHS[dt.getMonth()].slice(0,3)} ${dt.getDate()}`;
}

// ─── MiniCalendar ─────────────────────────────────────────────────────────────
function MiniCalendar({ tasks, onDayClick, selectedDate }) {
  const today = new Date();
  const [cur, setCur] = useState({ y: today.getFullYear(), m: today.getMonth() });

  const firstDay = new Date(cur.y, cur.m, 1).getDay();
  const daysInMonth = new Date(cur.y, cur.m + 1, 0).getDate();

  // Map due dates → set of "YYYY-MM-DD" strings
  const taskDates = new Set(tasks.map(t => t.due_date?.slice(0,10)).filter(Boolean));

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const toKey = (d) => `${cur.y}-${String(cur.m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const isToday = (d) => today.getFullYear()===cur.y && today.getMonth()===cur.m && today.getDate()===d;

  return (
    <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "14px 16px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button onClick={() => setCur(c => { const m = c.m-1<0?11:c.m-1; return { y: c.m-1<0?c.y-1:c.y, m }; })}
          style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 16, padding: "0 4px" }}>‹</button>
        <span style={{ fontWeight: 800, fontSize: 13, color: "#e2e8f0" }}>{MONTHS[cur.m]} {cur.y}</span>
        <button onClick={() => setCur(c => { const m = c.m+1>11?0:c.m+1; return { y: c.m+1>11?c.y+1:c.y, m }; })}
          style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 16, padding: "0 4px" }}>›</button>
      </div>
      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 }}>
        {DAYS.map(d => <div key={d} style={{ textAlign: "center", fontSize: 9, fontWeight: 700, color: "#475569", padding: "2px 0" }}>{d}</div>)}
      </div>
      {/* Date cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const key = toKey(d);
          const hasTasks = taskDates.has(key);
          const isSel = selectedDate === key;
          const isT   = isToday(d);
          return (
            <button key={i} onClick={() => onDayClick(key)}
              style={{
                aspectRatio: "1", width: "100%", border: "none", borderRadius: 6, cursor: "pointer",
                fontSize: 11, fontWeight: hasTasks || isT ? 800 : 400,
                background: isSel ? "#4f46e5" : isT ? "rgba(99,102,241,.25)" : hasTasks ? "rgba(96,165,250,.1)" : "transparent",
                color: isSel ? "#fff" : isT ? "#a5b4fc" : hasTasks ? "#60a5fa" : "#94a3b8",
                position: "relative",
              }}>
              {d}
              {hasTasks && !isSel && <span style={{ position: "absolute", bottom: 1, left: "50%", transform: "translateX(-50%)", width: 3, height: 3, borderRadius: "50%", background: "#60a5fa", display: "block" }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── TaskPanel ────────────────────────────────────────────────────────────────
function TaskPanel({ user, selectedDate, tasks, setTasks }) {
  const [form, setForm]   = useState({ title: "", due_date: selectedDate || "", type: "Task" });
  const [toast, setToast] = useState("");
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 2500); };

  useEffect(() => {
    setForm(f => ({ ...f, due_date: selectedDate || "" }));
  }, [selectedDate]);

  const filtered = selectedDate
    ? tasks.filter(t => t.due_date?.slice(0,10) === selectedDate)
    : tasks.filter(t => !t.is_done).slice(0, 10);

  const add = async () => {
    if (!form.title.trim()) return;
    try {
      const t = await taskApi.create({ userUuid: user._uuid, title: form.title.trim(), dueDate: form.due_date || null, type: form.type });
      setTasks(prev => [...prev, t]);
      setForm(f => ({ ...f, title: "" }));
      showToast("Task added!");
    } catch (e) { showToast("Error: " + e.message); }
  };

  const toggle = async (id, isDone) => {
    try {
      const updated = await taskApi.toggle(id, !isDone);
      setTasks(prev => prev.map(t => t.id === id ? updated : t));
    } catch (e) { showToast("Error: " + e.message); }
  };

  const remove = async (id) => {
    try {
      await taskApi.delete(id);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (e) { showToast("Error: " + e.message); }
  };

  return (
    <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontWeight: 800, fontSize: 13, color: "#e2e8f0" }}>
        {selectedDate ? `📅 ${fmtDate(selectedDate)}` : "📋 Upcoming Tasks"}
      </div>
      {toast && <Toast msg={toast} />}

      {/* Add form */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          onKeyDown={e => e.key === "Enter" && add()} placeholder="Add a task…" />
        <div style={{ display: "flex", gap: 6 }}>
          <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} style={{ flex: 1 }} />
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
            style={{ border: "1px solid #334155", borderRadius: 6, padding: "8px 6px", fontSize: 12, fontFamily: "inherit", color: "#e2e8f0", background: "#0f172a", cursor: "pointer" }}>
            {["Task","Assignment","Exam","Reminder"].map(t => <option key={t}>{t}</option>)}
          </select>
          <Btn size="sm" onClick={add}>+</Btn>
        </div>
      </div>

      {/* Task list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 260, overflowY: "auto" }}>
        {filtered.length === 0
          ? <div style={{ color: "#475569", fontSize: 12, textAlign: "center", padding: "16px 0" }}>No tasks{selectedDate ? " on this day" : " pending"}</div>
          : filtered.map(t => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "#0f172a", borderRadius: 8, border: "1px solid #1e293b", opacity: t.is_done ? 0.5 : 1 }}>
              <button onClick={() => toggle(t.id, t.is_done)}
                style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${TASK_COLORS[t.type] || "#6366f1"}`, background: t.is_done ? TASK_COLORS[t.type] || "#6366f1" : "transparent", cursor: "pointer", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.is_done ? "#475569" : "#e2e8f0", textDecoration: t.is_done ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</div>
                <div style={{ fontSize: 10, color: "#475569" }}>{t.type}{t.due_date ? ` · ${fmtDate(t.due_date)}` : ""}</div>
              </div>
              <button onClick={() => remove(t.id)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>×</button>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ─── AnnouncementCard ─────────────────────────────────────────────────────────
function AnnouncementCard({ ann, canEdit, onDelete, onPin }) {
  const meta = CAT_META[ann.category] || CAT_META.General;
  return (
    <div style={{ background: "#1e293b", border: `1px solid ${ann.pinned ? "#4f46e5" : "#334155"}`, borderRadius: 12, padding: "14px 16px", position: "relative" }}>
      {ann.pinned && <div style={{ position: "absolute", top: 10, right: 14, fontSize: 11, color: "#a5b4fc" }}>📌 Pinned</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ background: meta.bg, color: meta.color, fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 9999 }}>{ann.category}</span>
        <span style={{ fontSize: 11, color: "#475569" }}>{ann.author_name} · {timeAgo(ann.created_at)}</span>
      </div>
      <div style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9", marginBottom: 6 }}>{ann.title}</div>
      <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{ann.body}</div>
      {canEdit && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <Btn size="sm" variant="secondary" onClick={() => onPin(ann)}>
            {ann.pinned ? "Unpin" : "📌 Pin"}
          </Btn>
          <Btn size="sm" variant="danger" onClick={() => onDelete(ann.id)}>Delete</Btn>
        </div>
      )}
    </div>
  );
}

// ─── PostForm ─────────────────────────────────────────────────────────────────
function PostForm({ user, onPost }) {
  const [open,  setOpen]  = useState(false);
  const [form,  setForm]  = useState({ title: "", body: "", category: "General", pinned: false });
  const [busy,  setBusy]  = useState(false);

  const submit = async () => {
    if (!form.title.trim() || !form.body.trim()) return;
    setBusy(true);
    try {
      const ann = await announcementApi.create({
        authorId: user._uuid, authorName: user.fullName, authorRole: user.role,
        title: form.title.trim(), body: form.body.trim(),
        category: form.category, pinned: form.pinned,
      });
      onPost(ann);
      setForm({ title: "", body: "", category: "General", pinned: false });
      setOpen(false);
    } catch (e) { alert("Error: " + e.message); }
    setBusy(false);
  };

  if (!open) return (
    <button onClick={() => setOpen(true)}
      style={{ width: "100%", background: "#1e293b", border: "1px dashed #334155", borderRadius: 12, padding: "12px 16px", cursor: "pointer", color: "#475569", fontSize: 13, fontFamily: "inherit", textAlign: "left", transition: "border-color .15s" }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "#6366f1"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "#334155"}>
      ✏️ Write an announcement…
    </button>
  );

  return (
    <div style={{ background: "#1e293b", border: "1px solid #6366f1", borderRadius: 12, padding: "16px" }}>
      <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Announcement title…" style={{ marginBottom: 8 }} />
      <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
        placeholder="Write your announcement…" rows={4}
        style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", color: "#e2e8f0", resize: "vertical", outline: "none", marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
          style={{ border: "1px solid #334155", borderRadius: 6, padding: "6px 8px", fontSize: 12, fontFamily: "inherit", color: "#e2e8f0", background: "#0f172a", cursor: "pointer" }}>
          {["General","Academic","Events","Urgent"].map(c => <option key={c}>{c}</option>)}
        </select>
        <label style={{ fontSize: 12, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input type="checkbox" checked={form.pinned} onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))} /> Pin
        </label>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Btn variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancel</Btn>
          <Btn size="sm" onClick={submit} disabled={busy}>{busy ? "Posting…" : "Post"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard Component ─────────────────────────────────────────────────
export default function Dashboard({ user, courses = [], enrollments = [] }) {
  const [announcements, setAnnouncements] = useState([]);
  const [tasks,         setTasks]         = useState([]);
  const [selectedDate,  setSelectedDate]  = useState(null);
  const [loading,       setLoading]       = useState(true);

  // Only admin and sub_admin can post to the main dashboard announcements
  const canPost = ["admin", "sub_admin"].includes(user.role);

  useEffect(() => {
    let sub;
    (async () => {
      setLoading(true);
      try {
        const [anns, tks] = await Promise.all([
          announcementApi.getAll(),
          user._uuid ? taskApi.getForUser(user._uuid) : [],
        ]);
        setAnnouncements(anns);
        setTasks(tks);
      } catch (e) { console.error(e); }
      setLoading(false);

      // Realtime announcements
      sub = announcementApi.subscribe(() => {
        announcementApi.getAll().then(setAnnouncements).catch(console.error);
      });
    })();
    return () => { sub?.unsubscribe?.(); };
  }, [user._uuid]);

  const handlePost    = (ann) => setAnnouncements(prev => [ann, ...prev]);
  const handleDelete  = async (id) => { await announcementApi.delete(id); setAnnouncements(prev => prev.filter(a => a.id !== id)); };
  const handlePin     = async (ann) => { const u = await announcementApi.update(ann.id, { pinned: !ann.pinned }); setAnnouncements(prev => prev.map(a => a.id === u.id ? u : a)); };
  const handleDayClick = (key) => setSelectedDate(prev => prev === key ? null : key);

  // Stats
  const myEnrollments = enrollments.filter(e => e.studentId === user.id);
  const myCourses     = courses.filter(c => c.teacher === user.id);
  const pendingTasks  = tasks.filter(t => !t.is_done).length;

  const stats = user.role === "student"
    ? [{ icon: "📚", label: "Enrolled Courses", value: myEnrollments.length, color: "#60a5fa" },
       { icon: "📋", label: "Pending Tasks",    value: pendingTasks,          color: "#fbbf24" }]
    : user.role === "teacher"
    ? [{ icon: "📚", label: "My Courses",       value: myCourses.length,     color: "#a5b4fc" },
       { icon: "📋", label: "Pending Tasks",    value: pendingTasks,          color: "#fbbf24" }]
    : [{ icon: "📢", label: "Announcements",    value: announcements.length, color: "#60a5fa" },
       { icon: "📋", label: "Pending Tasks",    value: pendingTasks,          color: "#fbbf24" }];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar title="Dashboard" subtitle={`Welcome back, ${user.fullName}`} />

      <div style={{ flex: 1, overflow: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Stat strip */}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: 12 }}>
          {stats.map((s, i) => (
            <div key={i} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ fontSize: 26 }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Main 2-col layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, flex: 1, minHeight: 0 }}>
          {/* Left — Announcements */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, overflow: "auto" }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#e2e8f0" }}>📢 Announcements</div>
            {canPost && <PostForm user={user} onPost={handlePost} />}
            {loading
              ? <div style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: 32 }}>Loading…</div>
              : announcements.length === 0
              ? <div style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: 32 }}>No announcements yet.</div>
              : announcements.map(ann => (
                <AnnouncementCard key={ann.id} ann={ann}
                  canEdit={user._uuid === ann.author_id && ["admin","sub_admin"].includes(user.role) || user.role === "admin"}
                  onDelete={handleDelete} onPin={handlePin}
                />
              ))
            }
          </div>

          {/* Right — Calendar + Tasks */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <MiniCalendar tasks={tasks} onDayClick={handleDayClick} selectedDate={selectedDate} />
            <TaskPanel user={user} selectedDate={selectedDate} tasks={tasks} setTasks={setTasks} />
          </div>
        </div>
      </div>
    </div>
  );
}
