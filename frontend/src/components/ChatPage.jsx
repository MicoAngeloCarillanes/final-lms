/**
 * ChatPage.jsx — Real-time chat with channels
 * Design inspired by LMS-Project-main reference (dark, channel sidebar + message area)
 * Connected to Supabase for realtime messaging
 *
 * FOLDER: src/components/ChatPage.jsx
 *
 * Props: { user }
 */
import React, { useState, useEffect, useRef } from "react";
import { chatApi } from "../lib/api";
import TopBar from "./TopBar";
import { Btn } from "./ui";

const ROLE_COLOR = { admin: "#f59e0b", teacher: "#a5b4fc", student: "#34d399" };
const ROLE_BG    = { admin: "rgba(245,158,11,.15)", teacher: "rgba(99,102,241,.15)", student: "rgba(16,185,129,.15)" };

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Avatar({ name, role, size = 32 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: ROLE_BG[role] || "rgba(99,102,241,.15)",
      border: `1.5px solid ${ROLE_COLOR[role] || "#6366f1"}55`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.4, fontWeight: 800, color: ROLE_COLOR[role] || "#a5b4fc",
    }}>
      {name?.charAt(0)?.toUpperCase() || "?"}
    </div>
  );
}

function MessageBubble({ msg, isMine }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexDirection: isMine ? "row-reverse" : "row", marginBottom: 12 }}>
      {!isMine && <Avatar name={msg.sender_name} role={msg.sender_role} size={30} />}
      <div style={{ maxWidth: "70%", display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start" }}>
        {!isMine && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: ROLE_COLOR[msg.sender_role] || "#a5b4fc" }}>{msg.sender_name}</span>
            <span style={{ fontSize: 9, background: ROLE_BG[msg.sender_role], color: ROLE_COLOR[msg.sender_role], padding: "1px 6px", borderRadius: 9999, fontWeight: 700 }}>{msg.sender_role}</span>
          </div>
        )}
        <div style={{
          background: isMine ? "#4f46e5" : "#1e293b",
          border: `1px solid ${isMine ? "#6366f1" : "#334155"}`,
          borderRadius: isMine ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
          padding: "9px 13px", fontSize: 13, color: "#e2e8f0", lineHeight: 1.5, wordBreak: "break-word",
        }}>
          {msg.body}
        </div>
        <div style={{ fontSize: 10, color: "#475569", marginTop: 3 }}>{formatTime(msg.created_at)}</div>
      </div>
    </div>
  );
}

function ChannelItem({ ch, active, unread, onClick }) {
  const icons = { general: "🌐", "faculty-room": "🏫", "student-hub": "🎓" };
  const icon  = icons[ch.name] || "#";
  return (
    <button onClick={onClick}
      style={{
        width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 8,
        border: "none", cursor: "pointer", fontFamily: "inherit",
        background: active ? "#4f46e5" : "transparent",
        color: active ? "#fff" : "#94a3b8",
        transition: "all .15s", display: "flex", alignItems: "center", gap: 10, marginBottom: 2,
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#1e293b"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: active ? 700 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {ch.name}
        </div>
        {ch.description && <div style={{ fontSize: 10, color: active ? "rgba(255,255,255,.6)" : "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ch.description}</div>}
      </div>
      {unread > 0 && !active && (
        <span style={{ background: "#4f46e5", color: "#fff", fontSize: 10, padding: "1px 6px", borderRadius: 9999, fontWeight: 800 }}>{unread}</span>
      )}
    </button>
  );
}

export default function ChatPage({ user }) {
  const [channels,   setChannels]   = useState([]);
  const [activeId,   setActiveId]   = useState(null);
  const [messages,   setMessages]   = useState([]);
  const [input,      setInput]      = useState("");
  const [loading,    setLoading]    = useState(true);
  const [sending,    setSending]    = useState(false);
  const [newCh,      setNewCh]      = useState(false);
  const [newChName,  setNewChName]  = useState("");
  const [newChDesc,  setNewChDesc]  = useState("");

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const subRef    = useRef(null);

  // Load channels
  useEffect(() => {
    chatApi.getChannels().then(chs => {
      setChannels(chs);
      if (chs.length > 0) setActiveId(chs[0].id);
      setLoading(false);
    }).catch(console.error);
  }, []);

  // Load messages + subscribe when channel changes
  useEffect(() => {
    if (!activeId) return;
    setMessages([]);
    subRef.current?.unsubscribe?.();

    chatApi.getMessages(activeId).then(setMessages).catch(console.error);

    subRef.current = chatApi.subscribeMessages(activeId, (payload) => {
      if (payload.new) setMessages(prev => [...prev, payload.new]);
    });

    return () => { subRef.current?.unsubscribe?.(); };
  }, [activeId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const body = input.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await chatApi.sendMessage({
        channelId: activeId, senderId: user._uuid,
        senderName: user.fullName, senderRole: user.role, body,
      });
      setInput("");
      inputRef.current?.focus();
    } catch (e) { alert("Send failed: " + e.message); }
    setSending(false);
  };

  const createChannel = async () => {
    if (!newChName.trim()) return;
    try {
      const ch = await chatApi.createChannel({ name: newChName.trim().toLowerCase().replace(/\s+/g, "-"), description: newChDesc.trim() });
      setChannels(prev => [...prev, ch]);
      setActiveId(ch.id);
      setNewCh(false); setNewChName(""); setNewChDesc("");
    } catch (e) { alert("Error: " + e.message); }
  };

  const activeCh = channels.find(c => c.id === activeId);

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar title="Chat" subtitle="School messaging" />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#475569" }}>Loading channels…</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar title="Chat" subtitle="School messaging — realtime" />

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* ── Channel sidebar ── */}
        <div style={{ width: 240, background: "#0f172a", borderRight: "1px solid #1e293b", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "12px 14px 8px", borderBottom: "1px solid #1e293b" }}>
            <div style={{ fontWeight: 800, fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Channels</div>
            <nav style={{ display: "flex", flexDirection: "column" }}>
              {channels.map(ch => (
                <ChannelItem key={ch.id} ch={ch} active={ch.id === activeId} unread={0} onClick={() => setActiveId(ch.id)} />
              ))}
            </nav>
          </div>

          {/* Create channel (admin only) */}
          {user.role === "admin" && (
            <div style={{ padding: "10px 12px" }}>
              {!newCh
                ? <button onClick={() => setNewCh(true)}
                    style={{ width: "100%", background: "none", border: "1px dashed #334155", borderRadius: 7, padding: "7px", color: "#475569", fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}>
                    + New Channel
                  </button>
                : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <input value={newChName} onChange={e => setNewChName(e.target.value)} placeholder="channel-name"
                      style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 6, padding: "6px 8px", fontSize: 12, color: "#e2e8f0", fontFamily: "inherit", outline: "none" }} />
                    <input value={newChDesc} onChange={e => setNewChDesc(e.target.value)} placeholder="Description (optional)"
                      style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 6, padding: "6px 8px", fontSize: 12, color: "#e2e8f0", fontFamily: "inherit", outline: "none" }} />
                    <div style={{ display: "flex", gap: 5 }}>
                      <Btn size="sm" onClick={createChannel} style={{ flex: 1 }}>Create</Btn>
                      <Btn size="sm" variant="secondary" onClick={() => setNewCh(false)}>✕</Btn>
                    </div>
                  </div>
                )
              }
            </div>
          )}

          {/* Online indicator */}
          <div style={{ marginTop: "auto", padding: "10px 14px", borderTop: "1px solid #1e293b" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Avatar name={user.fullName} role={user.role} size={28} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#e2e8f0" }}>{user.fullName}</div>
                <div style={{ fontSize: 10, color: "#34d399", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", display: "inline-block" }} /> Online
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Message area ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Channel header */}
          {activeCh && (
            <div style={{ padding: "12px 20px", borderBottom: "1px solid #334155", background: "#1e293b", flexShrink: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9" }}>
                # {activeCh.name}
              </div>
              {activeCh.description && <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{activeCh.description}</div>}
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 8px" }}>
            {messages.length === 0
              ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#475569" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#64748b" }}>No messages yet</div>
                  <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>Be the first to say something!</div>
                </div>
              )
              : (
                <>
                  {messages.map((msg, i) => {
                    const isMine = msg.sender_id === user._uuid;
                    const prevMsg = messages[i - 1];
                    const sameAuthor = prevMsg && prevMsg.sender_id === msg.sender_id &&
                      new Date(msg.created_at) - new Date(prevMsg.created_at) < 120000;

                    return (
                      <div key={msg.id} style={{ marginTop: sameAuthor ? 2 : 14 }}>
                        {!sameAuthor && i > 0 && <div style={{ height: 2 }} />}
                        <MessageBubble msg={msg} isMine={isMine} />
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </>
              )
            }
          </div>

          {/* Input bar */}
          <div style={{ padding: "12px 20px", borderTop: "1px solid #334155", background: "#1e293b", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <div style={{ flex: 1, background: "#0f172a", border: "1px solid #334155", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center" }}
                onClick={() => inputRef.current?.focus()}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder={`Message #${activeCh?.name || ""}…`}
                  rows={1}
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", resize: "none", fontSize: 13, color: "#e2e8f0", fontFamily: "inherit", maxHeight: 120, overflow: "auto", lineHeight: 1.5 }}
                />
              </div>
              <Btn onClick={send} disabled={sending || !input.trim()}
                style={{ height: 42, paddingLeft: 18, paddingRight: 18, borderRadius: 10 }}>
                {sending ? "…" : "Send ↑"}
              </Btn>
            </div>
            <div style={{ fontSize: 10, color: "#334155", marginTop: 5 }}>Enter to send · Shift+Enter for new line</div>
          </div>
        </div>
      </div>
    </div>
  );
}
