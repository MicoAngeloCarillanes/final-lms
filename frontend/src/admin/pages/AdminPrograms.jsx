/**
 * AdminPrograms.jsx
 * FOLDER: src/admin/pages/AdminPrograms.jsx
 *
 * Two-level view:
 *   Level 1 — All programs as clickable cards
 *   Level 2 — Students enrolled in the selected program,
 *              filterable by search query, year level, and semester
 */

import React, { useState, useEffect, useMemo } from "react";
import { supabase }        from "../../supabaseClient";
import { Btn, Input, Sel } from "../../components/ui";
import TopBar              from "../../components/TopBar";

// ── Constants ─────────────────────────────────────────────────────────────────
const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"];
const SEMESTERS   = ["1st Semester", "2nd Semester", "Summer"];

// ── Palette for program cards (cycles) ────────────────────────────────────────
const CARD_COLORS = [
  { accent: "#6366f1", bg: "rgba(99,102,241,.1)",  border: "rgba(99,102,241,.25)"  },
  { accent: "#0ea5e9", bg: "rgba(14,165,233,.1)",  border: "rgba(14,165,233,.25)"  },
  { accent: "#34d399", bg: "rgba(16,185,129,.1)",  border: "rgba(16,185,129,.25)"  },
  { accent: "#f59e0b", bg: "rgba(245,158,11,.1)",  border: "rgba(245,158,11,.25)"  },
  { accent: "#f87171", bg: "rgba(239,68,68,.1)",   border: "rgba(239,68,68,.25)"   },
  { accent: "#a78bfa", bg: "rgba(167,139,250,.1)", border: "rgba(167,139,250,.25)" },
  { accent: "#fb923c", bg: "rgba(251,146,60,.1)",  border: "rgba(251,146,60,.25)"  },
  { accent: "#38bdf8", bg: "rgba(56,189,248,.1)",  border: "rgba(56,189,248,.25)"  },
];

// ── Small helpers ──────────────────────────────────────────────────────────────
const Pill = ({ label, color = "#6366f1" }) => (
  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 9999,
    background: `${color}22`, color, border: `1px solid ${color}44`, whiteSpace: "nowrap" }}>
    {label}
  </span>
);

const YearPill = ({ value }) => {
  const colors = { "1st Year": "#6366f1", "2nd Year": "#0ea5e9", "3rd Year": "#34d399", "4th Year": "#f59e0b", "5th Year": "#f87171" };
  return <Pill label={value} color={colors[value] || "#94a3b8"} />;
};

const SemPill = ({ value }) => {
  const colors = { "1st Semester": "#0ea5e9", "2nd Semester": "#8b5cf6", "Summer": "#f59e0b" };
  return <Pill label={value} color={colors[value] || "#94a3b8"} />;
};

// ── Program Card ───────────────────────────────────────────────────────────────
function ProgramCard({ program, studentCount, colorMeta, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? colorMeta.bg : "rgba(15,23,42,.6)",
        border: `1.5px solid ${hovered ? colorMeta.accent : colorMeta.border}`,
        borderRadius: 12,
        padding: "20px 22px",
        cursor: "pointer",
        transition: "all .18s",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? `0 8px 24px ${colorMeta.accent}22` : "none",
      }}
    >
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{
          fontSize: 13, fontWeight: 900, color: colorMeta.accent,
          letterSpacing: "0.07em", background: colorMeta.bg,
          border: `1px solid ${colorMeta.border}`, borderRadius: 7,
          padding: "3px 10px", flexShrink: 0,
        }}>
          {program.code}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: colorMeta.accent, lineHeight: 1 }}>
            {studentCount}
          </div>
          <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>
            student{studentCount !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Program name */}
      <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", lineHeight: 1.4 }}>
        {program.name}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
        {program.description && (
          <div style={{ fontSize: 11, color: "#475569", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
            {program.description}
          </div>
        )}
        <div style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: hovered ? colorMeta.accent : "#334155", transition: "color .18s" }}>
          View students →
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════
export default function AdminPrograms({ users }) {
  const students = useMemo(() => (users || []).filter(u => u.role === "student"), [users]);

  // ── Level & selection ─────────────────────────────────────────────────────────
  const [level,      setLevel]      = useState("list");   // "list" | "detail"
  const [selProgram, setSelProgram] = useState(null);

  // ── Programs data (from Supabase) ─────────────────────────────────────────────
  const [programs, setPrograms] = useState([]);
  const [loading,  setLoading]  = useState(false);

  // ── Filters for detail view ───────────────────────────────────────────────────
  const [search,    setSearch]    = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [semFilter,  setSemFilter]  = useState("");

  // ── Load programs ─────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("program")
        .select("program_id, code, name, description, is_active")
        .eq("is_deleted", false)
        .order("name", { ascending: true });
      if (!error) setPrograms(data || []);
      setLoading(false);
    })();
  }, []);

  // ── Derived: student count per program ────────────────────────────────────────
  const studentCountMap = useMemo(() => {
    const map = {};
    students.forEach(s => {
      if (s.programId) map[s.programId] = (map[s.programId] || 0) + 1;
    });
    return map;
  }, [students]);

  // ── Detail view: filtered students ────────────────────────────────────────────
  const detailStudents = useMemo(() => {
    if (!selProgram) return [];
    return students.filter(s => {
      if (String(s.programId) !== String(selProgram.program_id)) return false;
      if (yearFilter && s.yearLevel !== yearFilter) return false;
      if (semFilter  && s.semester  !== semFilter)  return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          s.fullName?.toLowerCase().includes(q) ||
          s.id?.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [students, selProgram, search, yearFilter, semFilter]);

  // ── Year / sem breakdowns for detail stats ────────────────────────────────────
  const yearBreakdown = useMemo(() => {
    if (!selProgram) return [];
    const base = students.filter(s => String(s.programId) === String(selProgram.program_id));
    return YEAR_LEVELS.map(yr => ({
      yr,
      count: base.filter(s => s.yearLevel === yr).length,
    })).filter(x => x.count > 0);
  }, [students, selProgram]);

  const drillProgram = (prog) => {
    setSelProgram(prog);
    setLevel("detail");
    setSearch(""); setYearFilter(""); setSemFilter("");
  };

  const goBack = () => {
    setLevel("list"); setSelProgram(null);
    setSearch(""); setYearFilter(""); setSemFilter("");
  };

  // ── Subtitle ──────────────────────────────────────────────────────────────────
  const subtitle = level === "list"
    ? `${programs.length} program${programs.length !== 1 ? "s" : ""}`
    : `${selProgram?.name} · ${detailStudents.length} student${detailStudents.length !== 1 ? "s" : ""}${search || yearFilter || semFilter ? " (filtered)" : ""}`;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      <TopBar
        title="Programs"
        subtitle={subtitle}
        actions={level === "detail" && (
          <Btn variant="secondary" size="sm" onClick={goBack}>← Back to Programs</Btn>
        )}
      />

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 20px",
        background: "#1e293b", borderBottom: "1px solid #334155", flexShrink: 0 }}>
        <button onClick={goBack}
          style={{ background: "none", border: "none", color: level === "list" ? "#f1f5f9" : "#6366f1",
            fontWeight: 700, cursor: level !== "list" ? "pointer" : "default", fontFamily: "inherit", fontSize: 12 }}>
          🎓 Programs
        </button>
        {selProgram && (<>
          <span style={{ color: "#334155" }}>›</span>
          <span style={{ color: "#f1f5f9", fontWeight: 700 }}>{selProgram.name}</span>
        </>)}
      </div>

      {/* ══ LEVEL: LIST ══ */}
      {level === "list" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {loading ? (
            <div style={{ color: "#475569", textAlign: "center", paddingTop: 60, fontSize: 13 }}>Loading programs…</div>
          ) : programs.length === 0 ? (
            <div style={{ color: "#475569", textAlign: "center", paddingTop: 60, fontSize: 13 }}>No programs found.</div>
          ) : (
            <>
              {/* Summary bar */}
              <div style={{ display: "flex", gap: 14, marginBottom: 22, flexWrap: "wrap" }}>
                {[
                  { icon: "🎓", value: programs.length,  label: "Programs",  color: "#a5b4fc" },
                  { icon: "👥", value: students.length,  label: "Students",  color: "#60a5fa" },
                  { icon: "✅", value: programs.filter(p => p.is_active).length, label: "Active", color: "#34d399" },
                ].map(({ icon, value, label, color }) => (
                  <div key={label} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10,
                    padding: "10px 18px", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{icon}</span>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
                      <div style={{ fontSize: 10, color: "#475569", marginTop: 1 }}>{label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Program grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
                {programs.map((prog, idx) => (
                  <ProgramCard
                    key={prog.program_id}
                    program={prog}
                    studentCount={studentCountMap[prog.program_id] || 0}
                    colorMeta={CARD_COLORS[idx % CARD_COLORS.length]}
                    onClick={() => drillProgram(prog)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ LEVEL: DETAIL ══ */}
      {level === "detail" && selProgram && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* ── Filter / Search bar ── */}
          <div style={{ background: "#1e293b", borderBottom: "1px solid #334155",
            padding: "10px 20px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>

            {/* Search */}
            <div style={{ position: "relative", flex: "1 1 220px", minWidth: 160 }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#475569", fontSize: 13, pointerEvents: "none" }}>🔍</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, ID or email…"
                style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 7,
                  padding: "7px 10px 7px 32px", fontSize: 12, color: "#e2e8f0", fontFamily: "inherit", outline: "none",
                  boxSizing: "border-box" }}
                onFocus={e => { e.target.style.borderColor = "#6366f1"; }}
                onBlur={e  => { e.target.style.borderColor = "#334155"; }}
              />
            </div>

            {/* Year filter */}
            <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
              style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 7,
                padding: "7px 12px", fontSize: 12, color: "#e2e8f0", fontFamily: "inherit",
                cursor: "pointer", outline: "none", minWidth: 130 }}>
              <option value="">All Year Levels</option>
              {YEAR_LEVELS.map(y => <option key={y}>{y}</option>)}
            </select>

            {/* Semester filter */}
            <select value={semFilter} onChange={e => setSemFilter(e.target.value)}
              style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 7,
                padding: "7px 12px", fontSize: 12, color: "#e2e8f0", fontFamily: "inherit",
                cursor: "pointer", outline: "none", minWidth: 140 }}>
              <option value="">All Semesters</option>
              {SEMESTERS.map(s => <option key={s}>{s}</option>)}
            </select>

            {/* Clear filters */}
            {(search || yearFilter || semFilter) && (
              <Btn size="sm" variant="secondary"
                onClick={() => { setSearch(""); setYearFilter(""); setSemFilter(""); }}>
                ✕ Clear
              </Btn>
            )}

            {/* Count */}
            <div style={{ marginLeft: "auto", fontSize: 12, color: "#475569", whiteSpace: "nowrap" }}>
              <strong style={{ color: "#e2e8f0" }}>{detailStudents.length}</strong> of{" "}
              {students.filter(s => String(s.programId) === String(selProgram.program_id)).length} students
            </div>
          </div>

          {/* ── Main content area ── */}
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

            {/* Left sidebar — program info & year breakdown */}
            <div style={{ width: 230, borderRight: "1px solid #334155", background: "#1e293b",
              padding: "16px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", flexShrink: 0 }}>

              {/* Program info card */}
              <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 10, padding: "14px" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#475569", textTransform: "uppercase",
                  letterSpacing: "0.07em", marginBottom: 10 }}>Program Info</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#a5b4fc", marginBottom: 4 }}>{selProgram.code}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", lineHeight: 1.4, marginBottom: 8 }}>{selProgram.name}</div>
                {selProgram.description && (
                  <div style={{ fontSize: 11, color: "#475569", fontStyle: "italic", lineHeight: 1.5 }}>{selProgram.description}</div>
                )}
              </div>

              {/* Total students */}
              <div style={{ background: "rgba(99,102,241,.08)", border: "1px solid rgba(99,102,241,.2)", borderRadius: 10, padding: "14px", textAlign: "center" }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#a5b4fc", lineHeight: 1 }}>
                  {students.filter(s => String(s.programId) === String(selProgram.program_id)).length}
                </div>
                <div style={{ fontSize: 11, color: "#6366f1", fontWeight: 700, marginTop: 4 }}>Total Students</div>
              </div>

              {/* Year breakdown */}
              {yearBreakdown.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#475569", textTransform: "uppercase",
                    letterSpacing: "0.07em", marginBottom: 8 }}>Year Breakdown</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {yearBreakdown.map(({ yr, count }) => {
                      const total = students.filter(s => String(s.programId) === String(selProgram.program_id)).length;
                      const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
                      const colors = { "1st Year": "#6366f1", "2nd Year": "#0ea5e9", "3rd Year": "#34d399", "4th Year": "#f59e0b", "5th Year": "#f87171" };
                      const col = colors[yr] || "#94a3b8";
                      return (
                        <div key={yr}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>{yr}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: col }}>{count}</span>
                          </div>
                          <div style={{ height: 4, background: "#1e293b", borderRadius: 9999 }}>
                            <div style={{ height: "100%", background: col, borderRadius: 9999, width: `${pct}%`, transition: "width .4s" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Active filters summary */}
              {(search || yearFilter || semFilter) && (
                <div style={{ background: "rgba(245,158,11,.07)", border: "1px solid rgba(245,158,11,.2)",
                  borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#f59e0b", textTransform: "uppercase",
                    letterSpacing: "0.07em", marginBottom: 6 }}>Active Filters</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {search     && <div style={{ fontSize: 11, color: "#94a3b8" }}>🔍 "{search}"</div>}
                    {yearFilter && <div style={{ fontSize: 11, color: "#94a3b8" }}>📅 {yearFilter}</div>}
                    {semFilter  && <div style={{ fontSize: 11, color: "#94a3b8" }}>📖 {semFilter}</div>}
                  </div>
                </div>
              )}
            </div>

            {/* Student table */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0" }}>
              {detailStudents.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", height: "100%", gap: 12 }}>
                  <div style={{ fontSize: 48 }}>👥</div>
                  <div style={{ color: "#475569", fontSize: 13, textAlign: "center", lineHeight: 1.8 }}>
                    {(search || yearFilter || semFilter)
                      ? "No students match the current filters."
                      : `No students enrolled in ${selProgram.code} yet.`}
                  </div>
                  {(search || yearFilter || semFilter) && (
                    <Btn size="sm" variant="secondary"
                      onClick={() => { setSearch(""); setYearFilter(""); setSemFilter(""); }}>
                      Clear filters
                    </Btn>
                  )}
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#1e293b", borderBottom: "2px solid #334155", position: "sticky", top: 0, zIndex: 1 }}>
                      {["#", "Student ID", "Full Name", "Email", "Year Level", "Semester"].map(h => (
                        <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 10,
                          fontWeight: 800, color: "#475569", textTransform: "uppercase",
                          letterSpacing: "0.07em", whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detailStudents.map((s, idx) => (
                      <tr key={s._uuid || s.id}
                        style={{ borderBottom: "1px solid #1e293b",
                          background: idx % 2 === 0 ? "transparent" : "rgba(30,41,59,.4)",
                          transition: "background .12s" }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(99,102,241,.07)"}
                        onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? "transparent" : "rgba(30,41,59,.4)"}
                      >
                        <td style={{ padding: "11px 16px", color: "#475569", fontSize: 11, fontWeight: 700 }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: "11px 16px" }}>
                          <span style={{ fontFamily: "monospace", fontSize: 12, color: "#a5b4fc", fontWeight: 700 }}>
                            {s.id}
                          </span>
                        </td>
                        <td style={{ padding: "11px 16px" }}>
                          <div style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 13 }}>{s.fullName}</div>
                          {s.username && (
                            <div style={{ fontSize: 10, color: "#475569", marginTop: 1 }}>@{s.username}</div>
                          )}
                        </td>
                        <td style={{ padding: "11px 16px", color: "#64748b", fontSize: 12 }}>
                          {s.email || <span style={{ color: "#334155", fontStyle: "italic" }}>—</span>}
                        </td>
                        <td style={{ padding: "11px 16px" }}>
                          {s.yearLevel ? <YearPill value={s.yearLevel} /> : <span style={{ color: "#334155" }}>—</span>}
                        </td>
                        <td style={{ padding: "11px 16px" }}>
                          {s.semester ? <SemPill value={s.semester} /> : <span style={{ color: "#334155" }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
