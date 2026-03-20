/**
 * SubAdminAnnouncements.jsx
 * FOLDER: src/sub-admin/pages/SubAdminAnnouncements.jsx  (new file)
 *
 * Sub-admins can create, edit, pin, and delete announcements within their scope.
 * Uses announcementApi (Supabase) — same as admin.
 */
import React, { useState, useEffect } from "react";
import { announcementApi } from "../../lib/api";
import { Badge, Btn, Input, Sel, FF, Toast } from "../../components/ui";
import TopBar from "../../components/TopBar";

const CATEGORIES = ["General", "Academic", "Events", "Urgent", "Maintenance"];

const emptyForm = { title: "", body: "", category: "General", pinned: false };

export default function SubAdminAnnouncements({ user }) {
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [form,       setForm]       = useState(emptyForm);
  const [editId,     setEditId]     = useState(null);
  const [mode,       setMode]       = useState("list");   // "list" | "create" | "edit"
  const [toast,      setToast]      = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const [busy,       setBusy]       = useState(false);

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 2800); };
  const upd = (f, v) => setForm(p => ({ ...p, [f]: v }));

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    announcementApi.getAll()
      .then(data => {
        // Sub-admins see their own and all general announcements
        setItems(data);
      })
      .catch(err => showToast("Failed to load: " + err.message))
      .finally(() => setLoading(false));

    const channel = announcementApi.subscribe(() => {
      announcementApi.getAll().then(setItems).catch(console.error);
    });
    return () => channel.unsubscribe();
  }, []);

  // ── Save (create or edit) ───────────────────────────────────────────────────
  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      showToast("Title and body are required."); return;
    }
    setBusy(true);
    try {
      if (mode === "create") {
        const created = await announcementApi.create({
          authorId:   user._uuid,
          authorName: user.fullName,
          authorRole: user.role,
          title:      form.title.trim(),
          body:       form.body.trim(),
          category:   form.category,
          pinned:     form.pinned,
        });
        setItems(prev => [created, ...prev]);
        showToast("Announcement posted!");
      } else {
        const updated = await announcementApi.update(editId, {
          title:    form.title.trim(),
          body:     form.body.trim(),
          category: form.category,
          pinned:   form.pinned,
        });
        setItems(prev => prev.map(a => a.id === editId ? updated : a));
        showToast("Announcement updated!");
      }
      setForm(emptyForm); setEditId(null); setMode("list");
    } catch (err) {
      showToast("Error: " + err.message);
    }
    setBusy(false);
  };

  const openEdit = (item) => {
    setForm({ title: item.title, body: item.body, category: item.category, pinned: !!item.pinned });
    setEditId(item.id);
    setMode("edit");
  };

  const togglePin = async (item) => {
    try {
      const updated = await announcementApi.update(item.id, { pinned: !item.pinned });
      setItems(prev => prev.map(a => a.id === item.id ? updated : a));
      showToast(updated.pinned ? "Announcement pinned." : "Announcement unpinned.");
    } catch (err) { showToast("Error: " + err.message); }
  };

  const doDelete = async () => {
    if (!confirmDel) return;
    try {
      await announcementApi.delete(confirmDel.id);
      setItems(prev => prev.filter(a => a.id !== confirmDel.id));
      setConfirmDel(null);
      showToast("Announcement deleted.");
    } catch (err) { showToast("Error: " + err.message); }
  };

  const myItems = items.filter(a => a.author_id === user._uuid);

  const catColor = {
    General:     ["rgba(100,116,139,.2)", "#94a3b8"],
    Academic:    ["rgba(59,130,246,.15)",  "#60a5fa"],
    Events:      ["rgba(99,102,241,.15)",  "#a5b4fc"],
    Urgent:      ["rgba(239,68,68,.15)",   "#f87171"],
    Maintenance: ["rgba(245,158,11,.15)",  "#fbbf24"],
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar
        title="Announcements"
        subtitle={`${user.scopeRef || user.fullName} · Post and manage announcements`}
        actions={
          mode === "list"
            ? <Btn onClick={() => { setForm(emptyForm); setMode("create"); }}>➕ New Announcement</Btn>
            : null
        }
      />

      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999 }}>
          <Toast msg={toast} />
        </div>
      )}

      {/* ── List ── */}
      {mode === "list" && (
        <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
          {loading ? (
            <div style={{ color: "#475569", fontSize: 14, textAlign: "center", paddingTop: 40 }}>Loading…</div>
          ) : myItems.length === 0 ? (
            <div style={{ textAlign: "center", paddingTop: 60 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📢</div>
              <div style={{ color: "#475569", fontSize: 14 }}>No announcements yet. Create your first one!</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 760 }}>
              {myItems.map(item => {
                const [cbg, ctxt] = catColor[item.category] || catColor.General;
                const isOwn = item.author_id === user._uuid;
                return (
                  <div key={item.id} style={{ background: "#1e293b", border: `1px solid ${item.pinned ? "#4f46e5" : "#334155"}`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                          {item.pinned && <span style={{ fontSize: 11, color: "#a5b4fc", fontWeight: 800 }}>📌 Pinned</span>}
                          <span style={{ background: cbg, color: ctxt, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 9999 }}>{item.category}</span>
                          <span style={{ fontSize: 10, color: "#475569" }}>{new Date(item.created_at).toLocaleString()}</span>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: "#f1f5f9", marginBottom: 6 }}>{item.title}</div>
                        <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{item.body}</div>
                      </div>
                      {isOwn && (
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <Btn size="sm" variant="ghost" onClick={() => togglePin(item)} title={item.pinned ? "Unpin" : "Pin"}>
                            {item.pinned ? "📌" : "📍"}
                          </Btn>
                          <Btn size="sm" variant="secondary" onClick={() => openEdit(item)}>✏️</Btn>
                          <Btn size="sm" variant="danger" onClick={() => setConfirmDel(item)}>🗑</Btn>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Create / Edit form ── */}
      {(mode === "create" || mode === "edit") && (
        <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
          <div style={{ maxWidth: 600, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9" }}>
              {mode === "create" ? "➕ New Announcement" : "✏️ Edit Announcement"}
            </div>

            <FF label="Title" required>
              <Input value={form.title} onChange={e => upd("title", e.target.value)} placeholder="Announcement title…" />
            </FF>

            <FF label="Body" required>
              <textarea
                value={form.body}
                onChange={e => upd("body", e.target.value)}
                rows={5}
                placeholder="Write your announcement here…"
                style={{ width: "100%", background: "#1e293b", border: "1px solid #334155", borderRadius: 6, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", color: "#e2e8f0", resize: "vertical", outline: "none" }}
              />
            </FF>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FF label="Category">
                <Sel value={form.category} onChange={e => upd("category", e.target.value)}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </Sel>
              </FF>
              <FF label="Pin to top">
                <div style={{ display: "flex", alignItems: "center", height: 38 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: "#94a3b8", userSelect: "none" }}>
                    <div onClick={() => upd("pinned", !form.pinned)}
                      style={{ width: 36, height: 20, borderRadius: 10, transition: "background .2s", cursor: "pointer", background: form.pinned ? "#4f46e5" : "#334155", position: "relative", flexShrink: 0 }}>
                      <div style={{ position: "absolute", top: 2, left: form.pinned ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
                    </div>
                    Pin this announcement
                  </label>
                </div>
              </FF>
            </div>

            <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
              <Btn onClick={save} disabled={busy} style={{ flex: 1 }}>
                {busy ? "⏳ Saving…" : mode === "create" ? "📢 Post Announcement" : "💾 Save Changes"}
              </Btn>
              <Btn variant="secondary" onClick={() => { setForm(emptyForm); setEditId(null); setMode("list"); }}>
                Cancel
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {confirmDel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "24px 28px", width: 400, maxWidth: "90vw" }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9", marginBottom: 8 }}>Delete Announcement</div>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
              Delete <strong style={{ color: "#e2e8f0" }}>"{confirmDel.title}"</strong>? This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Btn variant="secondary" onClick={() => setConfirmDel(null)}>Cancel</Btn>
              <Btn variant="danger" onClick={doDelete}>Delete</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
