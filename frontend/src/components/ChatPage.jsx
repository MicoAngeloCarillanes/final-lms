/**
 * ChatPage.jsx — Filtered channel chat with DM/search
 * FOLDER: src/components/ChatPage.jsx
 *
 * Channel visibility rules:
 *   🏫 faculty-room   → Admin + Sub-Admin + All Teachers
 *   🛡️ admin-desk     → Admin + Sub-Admin only
 *   💬 student-lounge → Admin + All Students
 *   🏛️ dept:{slug}    → Admin + that dept's Sub-Admin + dept teachers + enrolled students
 *   📚 course:{CODE}  → Admin + course teacher + enrolled students
 *
 * DM Search: within a course channel, search members → send a targeted
 * message; recipient gets an Accept/Reject prompt before it's visible.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../supabaseClient";
import TopBar from "./TopBar";
import { Btn } from "./ui";

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLE_COLOR = {
  admin:     "#f59e0b",
  sub_admin: "#c084fc",
  teacher:   "#a5b4fc",
  student:   "#34d399",
};
const ROLE_BG = {
  admin:     "rgba(245,158,11,.15)",
  sub_admin: "rgba(192,132,252,.15)",
  teacher:   "rgba(99,102,241,.15)",
  student:   "rgba(16,185,129,.15)",
};

const CH_META = {
  "faculty-room":   { icon: "🏫", label: "Faculty Room",    desc: "Staff lounge"       },
  "admin-desk":     { icon: "🛡️", label: "Admin Desk",      desc: "Coordination"        },
  "student-lounge": { icon: "💬", label: "Student Lounge",  desc: "Peer support"        },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(ts) {
  if (!ts) return "";
  const d   = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function initials(name = "") {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}

function canSeeChannel(ch, user, myCourseCodes, myDeptSlug) {
  const slug = ch.slug || ch.name;
  const r    = user.role;

  if (slug === "admin-desk")     return r === "admin" || r === "sub_admin";
  if (slug === "faculty-room")   return r === "admin" || r === "sub_admin" || r === "teacher";
  if (slug === "student-lounge") return r === "admin" || r === "student";

  if (slug.startsWith("dept:")) {
    const deptSlug = slug.replace("dept:", "");
    if (r === "admin") return true;
    if (r === "sub_admin") return user.subAdminScopeRef === deptSlug;
    if (r === "teacher" || r === "student") return myDeptSlug === deptSlug;
    return false;
  }
  if (slug.startsWith("course:")) {
    const code = slug.replace("course:", "").toUpperCase();
    if (r === "admin") return true;
    return myCourseCodes.includes(code);
  }
  return r === "admin"; // default: admin-only
}

function chIcon(ch) {
  const slug = ch.slug || ch.name;
  if (CH_META[slug]) return CH_META[slug].icon;
  if (slug.startsWith("dept:"))   return "🏛️";
  if (slug.startsWith("course:")) return "📚";
  return "💬";
}

function chLabel(ch) {
  const slug = ch.slug || ch.name;
  if (CH_META[slug]) return CH_META[slug].label;
  if (slug.startsWith("dept:"))   return "Dept: " + slug.replace("dept:", "").toUpperCase();
  if (slug.startsWith("course:")) return slug.replace("course:", "").toUpperCase();
  return ch.name;
}

function chDesc(ch) {
  const slug = ch.slug || ch.name;
  if (CH_META[slug]) return CH_META[slug].desc;
  if (ch.description) return ch.description;
  if (slug.startsWith("dept:"))   return "Department Hub";
  if (slug.startsWith("course:")) return "Course chat";
  return "";
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Avatar({ name, role, size = 32 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: ROLE_BG[role]  || "rgba(99,102,241,.15)",
      border: `1.5px solid ${(ROLE_COLOR[role] || "#6366f1")}55`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 800, color: ROLE_COLOR[role] || "#a5b4fc",
    }}>
      {initials(name)}
    </div>
  );
}

function RolePill({ role }) {
  return (
    <span style={{
      fontSize: 9, background: ROLE_BG[role], color: ROLE_COLOR[role],
      padding: "1px 6px", borderRadius: 9999, fontWeight: 700,
    }}>
      {role?.replace("_", " ")}
    </span>
  );
}

function MessageBubble({ msg, isMine, isDM, dmStatus, onAccept, onReject }) {
  const pending  = isDM && dmStatus === "pending"  && !isMine;
  const accepted = isDM && dmStatus === "accepted";
  const rejected = isDM && dmStatus === "rejected";

  return (
    <div style={{
      display: "flex", gap: 10, alignItems: "flex-start",
      flexDirection: isMine ? "row-reverse" : "row", marginBottom: 12,
      opacity: rejected ? 0.4 : 1,
    }}>
      {!isMine && <Avatar name={msg.sender_name} role={msg.sender_role} size={30} />}
      <div style={{ maxWidth: "70%", display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start" }}>
        {!isMine && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: ROLE_COLOR[msg.sender_role] || "#a5b4fc" }}>
              {msg.sender_name}
            </span>
            <RolePill role={msg.sender_role} />
            {isDM && (
              <span style={{ fontSize: 9, background: "rgba(99,102,241,.15)", color: "#a5b4fc", padding: "1px 6px", borderRadius: 9999, fontWeight: 700 }}>
                → you
              </span>
            )}
          </div>
        )}
        <div style={{
          background: isMine ? "#4f46e5" : isDM ? "rgba(99,102,241,.12)" : "#1e293b",
          border: `1px solid ${isMine ? "#6366f1" : isDM ? "rgba(99,102,241,.35)" : "#334155"}`,
          borderRadius: isMine ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
          padding: "9px 13px", fontSize: 13, color: "#e2e8f0", lineHeight: 1.5, wordBreak: "break-word",
        }}>
          {msg.body}
        </div>

        {/* Accept / Reject buttons for pending DM */}
        {pending && (
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button onClick={onAccept} style={{ background: "rgba(16,185,129,.15)", border: "1px solid rgba(16,185,129,.4)", color: "#34d399", borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              ✓ Accept
            </button>
            <button onClick={onReject} style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", color: "#f87171", borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              ✕ Reject
            </button>
          </div>
        )}
        {isDM && accepted && !isMine && (
          <div style={{ fontSize: 10, color: "#34d399", marginTop: 4 }}>✓ Accepted</div>
        )}
        {isDM && rejected && !isMine && (
          <div style={{ fontSize: 10, color: "#f87171", marginTop: 4 }}>Rejected</div>
        )}
        <div style={{ fontSize: 10, color: "#475569", marginTop: 3 }}>{fmtTime(msg.created_at)}</div>
      </div>
    </div>
  );
}

function ChannelItem({ ch, active, unread, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", textAlign: "left", padding: "9px 12px", borderRadius: 8,
      border: "none", cursor: "pointer", fontFamily: "inherit",
      background: active ? "#4f46e5" : "transparent",
      color: active ? "#fff" : "#94a3b8",
      transition: "all .15s", display: "flex", alignItems: "center", gap: 9, marginBottom: 2,
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#1e293b"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>{chIcon(ch)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: active ? 700 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {chLabel(ch)}
        </div>
        <div style={{ fontSize: 10, color: active ? "rgba(255,255,255,.5)" : "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {chDesc(ch)}
        </div>
      </div>
      {unread > 0 && !active && (
        <span style={{ background: "#ef4444", color: "#fff", fontSize: 10, padding: "1px 6px", borderRadius: 9999, fontWeight: 800, flexShrink: 0 }}>
          {unread}
        </span>
      )}
    </button>
  );
}

// ─── Main ChatPage ─────────────────────────────────────────────────────────────
export default function ChatPage({ user, courses = [], enrollments = [] }) {
  // Derived membership data
  const myCourseCodes = React.useMemo(() => {
    if (user.role === "teacher") return courses.filter(c => c.teacher === user.id).map(c => c.code);
    if (user.role === "student") return enrollments.filter(e => e.studentId === user.id).map(e => e.courseId);
    return courses.map(c => c.code);
  }, [user.id, user.role, courses, enrollments]);

  // For dept channels — derive department slug from teacher's courses or sub_admin scope
  const myDeptSlug = React.useMemo(() => {
    if (user.role === "sub_admin") return user.subAdminScopeRef || "";
    // For teachers/students: we'd need dept info — use scope_ref or first course dept
    return "";
  }, [user]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [channels,       setChannels]       = useState([]);
  const [activeId,       setActiveId]       = useState(null);
  const [messages,       setMessages]       = useState([]);
  const [dmMessages,     setDmMessages]     = useState([]); // direct_messages for this channel
  const [input,          setInput]          = useState("");
  const [loading,        setLoading]        = useState(true);
  const [sending,        setSending]        = useState(false);
  const [unreadMap,      setUnreadMap]      = useState({});

  // DM / Search state
  const [showSearch,     setShowSearch]     = useState(false);
  const [searchQuery,    setSearchQuery]    = useState("");
  const [searchResults,  setSearchResults]  = useState([]); // channel members
  const [dmTarget,       setDmTarget]       = useState(null); // { user_id, full_name, role }
  const [dmInput,        setDmInput]        = useState("");
  const [sendingDm,      setSendingDm]      = useState(false);
  const [memberCache,    setMemberCache]    = useState({}); // channelId → members[]

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const subRef    = useRef(null);
  const dmSubRef  = useRef(null);

  // ── Load channels & filter by role ────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("chat_channels")
        .select("*")
        .order("name");
      if (error || !data) { setLoading(false); return; }

      const visible = data.filter(ch => canSeeChannel(ch, user, myCourseCodes, myDeptSlug));
      setChannels(visible);
      if (visible.length > 0) setActiveId(visible[0].id);
      setLoading(false);
    }
    load();
  }, [user._uuid, myCourseCodes.join(","), myDeptSlug]);

  // ── Ensure default channels exist (admin auto-provision) ──────────────────
  useEffect(() => {
    if (user.role !== "admin") return;
    async function provision() {
      const defaults = [
        { slug: "faculty-room",   name: "faculty-room",   description: "Staff lounge",  type: "filtered" },
        { slug: "admin-desk",     name: "admin-desk",     description: "Coordination",  type: "filtered" },
        { slug: "student-lounge", name: "student-lounge", description: "Peer support",  type: "filtered" },
      ];
      for (const ch of defaults) {
        const { data: existing } = await supabase.from("chat_channels").select("id").eq("slug", ch.slug).maybeSingle();
        if (!existing) {
          await supabase.from("chat_channels").insert(ch);
        }
      }
      // Also provision course channels for all active courses
      const { data: courseList } = await supabase.from("courses").select("course_code, course_name").eq("is_active", true);
      for (const c of (courseList || [])) {
        const slug = `course:${c.course_code.toUpperCase()}`;
        const { data: ex } = await supabase.from("chat_channels").select("id").eq("slug", slug).maybeSingle();
        if (!ex) {
          await supabase.from("chat_channels").insert({ slug, name: slug, description: c.course_name, type: "filtered" });
        }
      }
    }
    provision();
  }, [user.role]);

  // ── Load messages + DMs + realtime sub ───────────────────────────────────
  useEffect(() => {
    if (!activeId) return;
    setMessages([]);
    setDmMessages([]);
    setShowSearch(false);
    setDmTarget(null);

    subRef.current?.unsubscribe?.();
    dmSubRef.current?.unsubscribe?.();

    // Regular messages
    supabase.from("chat_messages").select("*")
      .eq("channel_id", activeId).order("created_at", { ascending: true }).limit(120)
      .then(({ data }) => setMessages(data || []));

    // DMs for this channel involving this user
    supabase.from("direct_messages").select("*")
      .eq("channel_id", activeId)
      .or(`sender_id.eq.${user._uuid},recipient_id.eq.${user._uuid}`)
      .order("created_at", { ascending: true })
      .then(({ data }) => setDmMessages(data || []));

    // Realtime: regular messages
    subRef.current = supabase.channel(`chat-msg-${activeId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel_id=eq.${activeId}` },
        payload => { if (payload.new) setMessages(p => [...p, payload.new]); })
      .subscribe();

    // Realtime: DMs
    dmSubRef.current = supabase.channel(`chat-dm-${activeId}-${user._uuid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages", filter: `channel_id=eq.${activeId}` },
        payload => {
          const dm = payload.new;
          if (dm && (dm.sender_id === user._uuid || dm.recipient_id === user._uuid)) {
            setDmMessages(p => [...p, dm]);
            if (dm.recipient_id === user._uuid) {
              setUnreadMap(prev => ({ ...prev, [activeId]: (prev[activeId] || 0) + 1 }));
            }
          }
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "direct_messages", filter: `channel_id=eq.${activeId}` },
        payload => {
          if (payload.new) setDmMessages(p => p.map(d => d.id === payload.new.id ? payload.new : d));
        })
      .subscribe();

    return () => {
      subRef.current?.unsubscribe?.();
      dmSubRef.current?.unsubscribe?.();
    };
  }, [activeId, user._uuid]);

  // Scroll to bottom
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, dmMessages]);

  // ── Send regular message ──────────────────────────────────────────────────
  const send = async () => {
    const body = input.trim();
    if (!body || sending || !activeId) return;
    setSending(true);
    await supabase.from("chat_messages").insert({
      channel_id:  activeId,
      sender_id:   user._uuid,
      sender_name: user.fullName,
      sender_role: user.role,
      body,
    });
    setInput("");
    inputRef.current?.focus();
    setSending(false);
  };

  // ── Load channel members for search ──────────────────────────────────────
  const loadMembers = useCallback(async (channelId) => {
    if (memberCache[channelId]) { setSearchResults(memberCache[channelId]); return; }

    const ch = channels.find(c => c.id === channelId);
    if (!ch) return;
    const slug = ch.slug || ch.name;

    let members = [];

    if (slug.startsWith("course:")) {
      const code = slug.replace("course:", "").toUpperCase();
      // Get the course UUID
      const { data: courseRow } = await supabase.from("courses").select("course_id").eq("course_code", code).maybeSingle();
      if (courseRow) {
        // Enrolled students
        const { data: stuEnroll } = await supabase
          .from("student_course_assignments")
          .select("student_id, users!student_id(user_id, full_name, role, display_id)")
          .eq("course_id", courseRow.course_id)
          .eq("enrollment_status", "Enrolled");
        // Teacher
        const { data: tchAssign } = await supabase
          .from("teacher_course_assignments")
          .select("teacher_id, users!teacher_id(user_id, full_name, role, display_id)")
          .eq("course_id", courseRow.course_id);

        members = [
          ...(stuEnroll || []).map(r => r.users).filter(Boolean),
          ...(tchAssign || []).map(r => r.users).filter(Boolean),
        ].filter(m => m.user_id !== user._uuid); // exclude self
      }
    } else if (slug === "faculty-room") {
      const { data } = await supabase.from("users").select("user_id, full_name, role, display_id")
        .in("role", ["teacher", "admin", "sub_admin"]).eq("is_active", true);
      members = (data || []).filter(m => m.user_id !== user._uuid);
    } else if (slug === "student-lounge") {
      const { data } = await supabase.from("users").select("user_id, full_name, role, display_id")
        .in("role", ["student", "admin"]).eq("is_active", true);
      members = (data || []).filter(m => m.user_id !== user._uuid);
    } else {
      const { data } = await supabase.from("users").select("user_id, full_name, role, display_id").eq("is_active", true);
      members = (data || []).filter(m => m.user_id !== user._uuid);
    }

    setMemberCache(p => ({ ...p, [channelId]: members }));
    setSearchResults(members);
  }, [channels, user._uuid, memberCache]);

  const openSearch = async () => {
    setShowSearch(true);
    setSearchQuery("");
    setDmTarget(null);
    await loadMembers(activeId);
  };

  const filteredMembers = searchQuery.trim()
    ? (memberCache[activeId] || []).filter(m =>
        m.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.display_id?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : (memberCache[activeId] || []);

  // ── Send DM ───────────────────────────────────────────────────────────────
  const sendDm = async () => {
    const body = dmInput.trim();
    if (!body || !dmTarget || sendingDm) return;
    setSendingDm(true);
    await supabase.from("direct_messages").insert({
      channel_id:   activeId,
      sender_id:    user._uuid,
      sender_name:  user.fullName,
      sender_role:  user.role,
      recipient_id: dmTarget.user_id,
      body,
      status:       "pending",
    });
    setDmInput("");
    setDmTarget(null);
    setShowSearch(false);
    setSendingDm(false);
  };

  // ── Accept / Reject DM ────────────────────────────────────────────────────
  const handleDmStatus = async (dmId, status) => {
    await supabase.from("direct_messages").update({ status }).eq("id", dmId);
  };

  // ── Merge and sort messages + accepted DMs ────────────────────────────────
  const combinedMessages = React.useMemo(() => {
    const regs = messages.map(m => ({ ...m, _type: "msg" }));
    // Show DMs: always show my sent ones + accepted/pending DMs sent to me
    const dms = dmMessages
      .filter(d =>
        d.sender_id === user._uuid ||        // my sent DMs (always visible)
        d.recipient_id === user._uuid         // DMs to me (pending=show for accept, accepted=show)
      )
      .filter(d => d.status !== "rejected" || d.sender_id === user._uuid)
      .map(m => ({ ...m, _type: "dm" }));
    return [...regs, ...dms].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }, [messages, dmMessages, user._uuid]);

  const activeCh = channels.find(c => c.id === activeId);
  const isCourseChannel = (activeCh?.slug || activeCh?.name || "").startsWith("course:");

  // Group channels by type for sidebar
  const globalChannels = channels.filter(ch => {
    const s = ch.slug || ch.name;
    return ["faculty-room", "admin-desk", "student-lounge"].includes(s);
  });
  const deptChannels = channels.filter(ch => (ch.slug || ch.name).startsWith("dept:"));
  const courseChannels = channels.filter(ch => (ch.slug || ch.name).startsWith("course:"));

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar title="Chat" icon="💬" />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#475569" }}>Loading…</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar title="Chat" icon="💬" subtitle="School messaging — realtime" />

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── Channel Sidebar ────────────────────────────────────────────── */}
        <div style={{ width: 232, background: "#0a1120", borderRight: "1px solid #1e293b", display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" }}>

          {/* Global channels */}
          {globalChannels.length > 0 && (
            <div style={{ padding: "14px 10px 6px" }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#334155", textTransform: "uppercase", letterSpacing: ".1em", padding: "0 4px", marginBottom: 4 }}>
                General
              </div>
              {globalChannels.map(ch => (
                <ChannelItem key={ch.id} ch={ch} active={ch.id === activeId} unread={unreadMap[ch.id] || 0} onClick={() => setActiveId(ch.id)} />
              ))}
            </div>
          )}

          {/* Dept channels */}
          {deptChannels.length > 0 && (
            <div style={{ padding: "8px 10px 6px" }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#334155", textTransform: "uppercase", letterSpacing: ".1em", padding: "0 4px", marginBottom: 4 }}>
                Departments
              </div>
              {deptChannels.map(ch => (
                <ChannelItem key={ch.id} ch={ch} active={ch.id === activeId} unread={unreadMap[ch.id] || 0} onClick={() => setActiveId(ch.id)} />
              ))}
            </div>
          )}

          {/* Course channels */}
          {courseChannels.length > 0 && (
            <div style={{ padding: "8px 10px 6px" }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#334155", textTransform: "uppercase", letterSpacing: ".1em", padding: "0 4px", marginBottom: 4 }}>
                My Courses
              </div>
              {courseChannels.map(ch => (
                <ChannelItem key={ch.id} ch={ch} active={ch.id === activeId} unread={unreadMap[ch.id] || 0} onClick={() => setActiveId(ch.id)} />
              ))}
            </div>
          )}

          {channels.length === 0 && (
            <div style={{ padding: 16, color: "#475569", fontSize: 12, textAlign: "center" }}>No channels available</div>
          )}

          {/* Admin: provision dept/course channels */}
          {user.role === "admin" && (
            <div style={{ padding: "8px 10px", marginTop: "auto", borderTop: "1px solid #1e293b" }}>
              <div style={{ fontSize: 10, color: "#334155", marginBottom: 6 }}>Auto-provisioned on load</div>
            </div>
          )}

          {/* Self identity */}
          <div style={{ padding: "10px 14px", borderTop: "1px solid #1e293b", marginTop: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Avatar name={user.fullName} role={user.role} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.fullName}</div>
                <div style={{ fontSize: 10, color: "#34d399", display: "flex", alignItems: "center", gap: 3 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#34d399", display: "inline-block" }} /> Online
                </div>
              </div>
              <RolePill role={user.role} />
            </div>
          </div>
        </div>

        {/* ── Message Area ───────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Channel header */}
          {activeCh && (
            <div style={{ padding: "11px 20px", borderBottom: "1px solid #334155", background: "#1e293b", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: "#f1f5f9", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{chIcon(activeCh)}</span>
                  {chLabel(activeCh)}
                </div>
                <div style={{ fontSize: 11, color: "#475569", marginTop: 1 }}>{chDesc(activeCh)}</div>
              </div>
              {/* Search / DM button — only for course channels */}
              {isCourseChannel && (
                <button onClick={openSearch} style={{
                  background: showSearch ? "rgba(99,102,241,.2)" : "rgba(99,102,241,.08)",
                  border: "1px solid rgba(99,102,241,.3)", borderRadius: 8,
                  padding: "6px 14px", color: "#a5b4fc", fontWeight: 700, fontSize: 12,
                  cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
                }}>
                  🔍 Search Members
                </button>
              )}
            </div>
          )}

          {/* Search panel (slides in over messages) */}
          {showSearch && (
            <div style={{ background: "#0f172a", borderBottom: "1px solid #334155", padding: "12px 20px", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                <div style={{ flex: 1, background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#475569", fontSize: 14 }}>🔍</span>
                  <input
                    autoFocus
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by name or ID…"
                    style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#e2e8f0", fontSize: 13, fontFamily: "inherit" }}
                  />
                </div>
                <button onClick={() => { setShowSearch(false); setDmTarget(null); setSearchQuery(""); }}
                  style={{ background: "none", border: "none", color: "#475569", fontSize: 20, cursor: "pointer" }}>×</button>
              </div>

              {/* DM compose */}
              {dmTarget && (
                <div style={{ background: "#1e293b", border: "1px solid rgba(99,102,241,.3)", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Avatar name={dmTarget.full_name} role={dmTarget.role} size={26} />
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>To: {dmTarget.full_name}</span>
                      <RolePill role={dmTarget.role} />
                    </div>
                    <button onClick={() => setDmTarget(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 16 }}>×</button>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      autoFocus
                      value={dmInput}
                      onChange={e => setDmInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") sendDm(); }}
                      placeholder="Type a message… (recipient must accept)"
                      style={{ flex: 1, background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "8px 10px", color: "#e2e8f0", fontSize: 13, fontFamily: "inherit", outline: "none" }}
                    />
                    <button onClick={sendDm} disabled={sendingDm || !dmInput.trim()} style={{
                      background: "#4f46e5", border: "none", borderRadius: 6, padding: "8px 14px",
                      color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                    }}>
                      {sendingDm ? "…" : "Send ↑"}
                    </button>
                  </div>
                  <div style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>
                    The recipient will see an Accept / Reject prompt before this message becomes visible.
                  </div>
                </div>
              )}

              {/* Member list */}
              <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
                {filteredMembers.length === 0 && (
                  <div style={{ color: "#475569", fontSize: 12, textAlign: "center", padding: 12 }}>
                    {searchQuery ? "No members found." : "Loading members…"}
                  </div>
                )}
                {filteredMembers.map(m => (
                  <div key={m.user_id}
                    onClick={() => { setDmTarget(m); setSearchQuery(""); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "7px 10px",
                      borderRadius: 7, cursor: "pointer", transition: "background .1s",
                      background: dmTarget?.user_id === m.user_id ? "rgba(99,102,241,.15)" : "transparent",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(99,102,241,.1)"}
                    onMouseLeave={e => e.currentTarget.style.background = dmTarget?.user_id === m.user_id ? "rgba(99,102,241,.15)" : "transparent"}
                  >
                    <Avatar name={m.full_name} role={m.role} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {m.full_name}
                      </div>
                      <div style={{ fontSize: 10, color: "#475569" }}>{m.display_id}</div>
                    </div>
                    <RolePill role={m.role} />
                    <span style={{ fontSize: 11, color: "#a5b4fc", fontWeight: 700 }}>DM →</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 8px" }}>
            {combinedMessages.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#475569" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>{activeCh ? chIcon(activeCh) : "💬"}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#64748b" }}>No messages yet</div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>Be the first to say something!</div>
              </div>
            ) : (
              <>
                {combinedMessages.map((msg, i) => {
                  const isMine = msg.sender_id === user._uuid;
                  const prev   = combinedMessages[i - 1];
                  const sameAuthor = prev && prev.sender_id === msg.sender_id &&
                    new Date(msg.created_at) - new Date(prev.created_at) < 120000;

                  if (msg._type === "dm") {
                    return (
                      <div key={`dm-${msg.id}`} style={{ marginTop: sameAuthor ? 2 : 14 }}>
                        <MessageBubble
                          msg={msg} isMine={isMine}
                          isDM={true} dmStatus={msg.status}
                          onAccept={() => handleDmStatus(msg.id, "accepted")}
                          onReject={() => handleDmStatus(msg.id, "rejected")}
                        />
                      </div>
                    );
                  }
                  return (
                    <div key={`msg-${msg.id}`} style={{ marginTop: sameAuthor ? 2 : 14 }}>
                      <MessageBubble msg={msg} isMine={isMine} isDM={false} />
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          {/* Input bar */}
          <div style={{ padding: "12px 20px", borderTop: "1px solid #334155", background: "#1e293b", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <div
                style={{ flex: 1, background: "#0f172a", border: "1px solid #334155", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center" }}
                onClick={() => inputRef.current?.focus()}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder={activeCh ? `Message ${chIcon(activeCh)} ${chLabel(activeCh)}…` : "Select a channel…"}
                  rows={1}
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", resize: "none", fontSize: 13, color: "#e2e8f0", fontFamily: "inherit", maxHeight: 120, overflow: "auto", lineHeight: 1.5 }}
                />
              </div>
              <Btn onClick={send} disabled={sending || !input.trim() || !activeId}
                style={{ height: 42, paddingLeft: 18, paddingRight: 18, borderRadius: 10 }}>
                {sending ? "…" : "Send ↑"}
              </Btn>
            </div>
            <div style={{ fontSize: 10, color: "#334155", marginTop: 5 }}>
              Enter to send · Shift+Enter for new line{isCourseChannel ? " · 🔍 Search Members to send a private message" : ""}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
