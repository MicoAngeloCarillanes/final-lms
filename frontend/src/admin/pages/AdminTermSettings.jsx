/**
 * AdminTermSettings.jsx
 * FOLDER: frontend/src/admin/pages/AdminTermSettings.jsx
 *
 * Admin page to configure which months belong to which academic term.
 * Changes are saved to the `term_settings` Supabase table and are
 * immediately picked up by TeacherCourses, ExamBuilder, and
 * TeacherAttendanceTab when they auto-detect the current term.
 */

import React, { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { EXAM_TERMS, TERM_META } from "../../lib/constants";
import { invalidateTermSettingsCache } from "../../lib/termSettingsHelper";
import TopBar from "../../components/TopBar";
import { Btn } from "../../components/ui";

// ─── Theme ─────────────────────────────────────────────────────────────────────
const C = {
  bg:    "#0f172a",
  bg2:   "#1e293b",
  bg3:   "#162032",
  bdr:   "#334155",
  txt:   "#e2e8f0",
  muted: "#64748b",
  dim:   "#475569",
};

const MONTHS = [
  { n: 1,  label: "January",   abbr: "Jan" },
  { n: 2,  label: "February",  abbr: "Feb" },
  { n: 3,  label: "March",     abbr: "Mar" },
  { n: 4,  label: "April",     abbr: "Apr" },
  { n: 5,  label: "May",       abbr: "May" },
  { n: 6,  label: "June",      abbr: "Jun" },
  { n: 7,  label: "July",      abbr: "Jul" },
  { n: 8,  label: "August",    abbr: "Aug" },
  { n: 9,  label: "September", abbr: "Sep" },
  { n: 10, label: "October",   abbr: "Oct" },
  { n: 11, label: "November",  abbr: "Nov" },
  { n: 12, label: "December",  abbr: "Dec" },
];

// Default fallback (mirrors constants.js hardcoded values)
const DEFAULT_SETTINGS = {
  "Prelim":     [8, 9, 10, 6, 7],
  "Midterm":    [11, 12],
  "Semi-Final": [1, 2],
  "Finals":     [3, 4, 5],
};

export default function AdminTermSettings({ user }) {
  // { Prelim: Set([8,9,10,...]), ... }
  const [settings, setSettings] = useState(() => {
    const s = {};
    EXAM_TERMS.forEach(t => { s[t] = new Set(DEFAULT_SETTINGS[t] || []); });
    return s;
  });

  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState({ msg: "", type: "ok" });

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "ok" }), 3500);
  };

  // ── Load current settings ───────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("term_settings")
        .select("term, months");

      if (!error && data?.length) {
        const s = {};
        EXAM_TERMS.forEach(t => { s[t] = new Set(); }); // clear first
        data.forEach(r => { s[r.term] = new Set(r.months || []); });
        setSettings(s);
      }
      setLoading(false);
    })();
  }, []);

  // ── Toggle a month for a term ───────────────────────────────────────────────
  const toggleMonth = (term, month) => {
    setSettings(prev => {
      const next = { ...prev };
      const set  = new Set(prev[term]);
      if (set.has(month)) {
        set.delete(month);
      } else {
        // Remove from other terms first (a month can only belong to one term)
        EXAM_TERMS.forEach(t => {
          if (t !== term) next[t] = new Set([...next[t]].filter(m => m !== month));
        });
        set.add(month);
      }
      next[term] = set;
      return next;
    });
  };

  // ── Derived: which months are unassigned ────────────────────────────────────
  const assignedMonths = new Set(
    EXAM_TERMS.flatMap(t => [...settings[t]])
  );
  const unassigned = MONTHS.filter(m => !assignedMonths.has(m.n));

  // ── Save ────────────────────────────────────────────────────────────────────
  const save = async () => {
    setSaving(true);
    const rows = EXAM_TERMS.map(term => ({
      term,
      months:     [...settings[term]].sort((a, b) => a - b),
      updated_at: new Date().toISOString(),
      updated_by: user?._uuid || null,
    }));

    const { error } = await supabase
      .from("term_settings")
      .upsert(rows, { onConflict: "term" });

    setSaving(false);
    if (error) {
      showToast("Error saving: " + error.message, "err");
    } else {
      invalidateTermSettingsCache(); // bust the in-memory cache
      showToast("Term settings saved! Teachers will see updated terms on next page load.");
    }
  };

  // ── Reset to defaults ───────────────────────────────────────────────────────
  const resetDefaults = () => {
    const s = {};
    EXAM_TERMS.forEach(t => { s[t] = new Set(DEFAULT_SETTINGS[t]); });
    setSettings(s);
    showToast("Reset to default — click Save to apply.", "warn");
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: C.bg }}>
      <TopBar
        title="Term Settings"
        subtitle="Configure which months map to each academic term"
      />

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Toast ── */}
        {toast.msg && (
          <div style={{
            padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: toast.type === "err"  ? "rgba(248,113,113,.15)"
                      : toast.type === "warn" ? "rgba(251,191,36,.15)"
                      : "rgba(52,211,153,.15)",
            color:      toast.type === "err"  ? "#f87171"
                      : toast.type === "warn" ? "#fbbf24"
                      : "#34d399",
            border: `1px solid ${
              toast.type === "err"  ? "rgba(248,113,113,.3)"
            : toast.type === "warn" ? "rgba(251,191,36,.3)"
            : "rgba(52,211,153,.3)"}`,
            alignSelf: "flex-start",
          }}>
            {toast.msg}
          </div>
        )}

        {/* ── Info banner ── */}
        <div style={{
          background: "rgba(99,102,241,.1)", border: "1px solid rgba(99,102,241,.3)",
          borderRadius: 10, padding: "14px 18px", fontSize: 13, color: "#a5b4fc",
          lineHeight: 1.6,
        }}>
          <strong>How this works:</strong> Each month can belong to exactly one term. When a teacher creates a course material, exam, or attendance session, the <em>Term</em> dropdown is automatically pre-filled based on the current month using the mapping below. Teachers can still change the term manually.
          <br /><br />
          <strong>Click a month chip</strong> under a term to assign it. Clicking a month that's already assigned elsewhere will move it to the new term.
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: C.muted }}>Loading…</div>
        ) : (
          <>
            {/* ── Month calendar overview ── */}
            <div style={{ background: C.bg2, border: `1px solid ${C.bdr}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.bdr}`, background: C.bg, fontWeight: 800, fontSize: 13, color: C.txt }}>
                📅 Month → Term Overview
              </div>
              <div style={{ padding: "16px 18px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 8 }}>
                  {MONTHS.map(({ n, abbr }) => {
                    const assignedTerm = EXAM_TERMS.find(t => settings[t]?.has(n));
                    const meta = assignedTerm ? TERM_META[assignedTerm] : null;
                    return (
                      <div key={n} style={{
                        textAlign: "center", padding: "10px 4px",
                        borderRadius: 8, fontSize: 12, fontWeight: 700,
                        background: meta ? meta.bg : "rgba(100,116,139,.1)",
                        color:      meta ? meta.color : C.dim,
                        border: `1px solid ${meta ? meta.color + "40" : C.bdr}`,
                      }}>
                        <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 3 }}>{abbr}</div>
                        <div style={{ fontSize: 9, fontWeight: 800 }}>{assignedTerm || "—"}</div>
                      </div>
                    );
                  })}
                </div>

                {unassigned.length > 0 && (
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#f87171" }}>⚠ Unassigned months:</span>
                    {unassigned.map(m => (
                      <span key={m.n} style={{ fontSize: 11, fontWeight: 700, color: "#f87171", background: "rgba(248,113,113,.15)", padding: "2px 8px", borderRadius: 9999 }}>
                        {m.label}
                      </span>
                    ))}
                    <span style={{ fontSize: 11, color: C.muted }}>— these will fall back to the hardcoded defaults.</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Per-term editors ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {EXAM_TERMS.map(term => {
                const meta = TERM_META[term];
                const assigned = [...settings[term]].sort((a, b) => a - b);
                return (
                  <div key={term} style={{
                    background: C.bg2, border: `1px solid ${C.bdr}`,
                    borderRadius: 12, overflow: "hidden",
                    borderTop: `3px solid ${meta.color}`,
                  }}>
                    {/* Term header */}
                    <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{
                        fontSize: 12, fontWeight: 800,
                        color: meta.color, background: meta.bg,
                        padding: "3px 12px", borderRadius: 9999,
                      }}>{term}</span>
                      <span style={{ fontSize: 12, color: C.muted }}>
                        {assigned.length} month{assigned.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {/* Month grid */}
                    <div style={{ padding: "0 18px 18px", display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {MONTHS.map(({ n, label, abbr }) => {
                        const isThis    = settings[term]?.has(n);
                        const otherTerm = !isThis && EXAM_TERMS.find(t => t !== term && settings[t]?.has(n));
                        const otherMeta = otherTerm ? TERM_META[otherTerm] : null;

                        return (
                          <button
                            key={n}
                            onClick={() => toggleMonth(term, n)}
                            title={otherTerm ? `Move from ${otherTerm} to ${term}` : label}
                            style={{
                              padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                              cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
                              border: `1.5px solid ${
                                isThis    ? meta.color + "80"
                              : otherTerm ? otherMeta.color + "40"
                              : C.bdr}`,
                              background: isThis    ? meta.bg
                                        : otherTerm ? "transparent"
                                        : "rgba(100,116,139,.08)",
                              color:      isThis    ? meta.color
                                        : otherTerm ? otherMeta.color + "99"
                                        : C.dim,
                              position: "relative",
                            }}
                            onMouseEnter={e => {
                              if (!isThis) {
                                e.currentTarget.style.background = meta.bg;
                                e.currentTarget.style.borderColor = meta.color + "60";
                                e.currentTarget.style.color = meta.color;
                              }
                            }}
                            onMouseLeave={e => {
                              if (!isThis) {
                                e.currentTarget.style.background = otherTerm ? "transparent" : "rgba(100,116,139,.08)";
                                e.currentTarget.style.borderColor = otherTerm ? otherMeta?.color + "40" : C.bdr;
                                e.currentTarget.style.color = otherTerm ? otherMeta?.color + "99" : C.dim;
                              }
                            }}
                          >
                            {abbr}
                            {isThis && <span style={{ marginLeft: 4 }}>✓</span>}
                            {otherTerm && !isThis && (
                              <span style={{ fontSize: 9, display: "block", marginTop: 1, opacity: 0.7 }}>
                                ({otherTerm.slice(0, 4)})
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Current assigned months summary */}
                    <div style={{ padding: "10px 18px", borderTop: `1px solid ${C.bdr}`, background: C.bg, fontSize: 11, color: C.muted }}>
                      {assigned.length === 0
                        ? <span style={{ color: "#f87171" }}>⚠ No months assigned — will use hardcoded fallback</span>
                        : assigned.map(n => MONTHS.find(m => m.n === n)?.label).join(" · ")}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Action bar ── */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 18px", background: C.bg2, border: `1px solid ${C.bdr}`,
              borderRadius: 10,
            }}>
              <button
                onClick={resetDefaults}
                style={{
                  fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 7,
                  border: `1px solid ${C.bdr}`, background: "transparent",
                  color: C.muted, cursor: "pointer", fontFamily: "inherit",
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#fbbf24"}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.bdr}
              >
                ↺ Reset to Defaults
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 11, color: C.muted }}>
                  Changes take effect immediately for all new materials and exams.
                </span>
                <Btn onClick={save} disabled={saving}>
                  {saving ? "Saving…" : "💾 Save Term Settings"}
                </Btn>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
