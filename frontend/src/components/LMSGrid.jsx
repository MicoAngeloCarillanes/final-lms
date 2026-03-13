import React, { useState, useMemo } from "react";

export default function LMSGrid({ columns, rowData, onRowClick, height = "100%", pageSize = 12, selectedId }) {
  const [q,    setQ]    = useState("");
  const [sc,   setSc]   = useState(null);
  const [dir,  setDir]  = useState("asc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!q) return rowData;
    const lq = q.toLowerCase();
    return rowData.filter(r => Object.values(r).some(v => String(v ?? "").toLowerCase().includes(lq)));
  }, [rowData, q]);

  const sorted = useMemo(() => {
    if (!sc) return filtered;
    return [...filtered].sort((a, b) => {
      const va = a[sc] ?? "", vb = b[sc] ?? "";
      return (dir === "asc" ? 1 : -1) * String(va).localeCompare(String(vb), undefined, { numeric: true });
    });
  }, [filtered, sc, dir]);

  const total = Math.max(1, Math.ceil(sorted.length / pageSize));
  const rows  = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const toggleSort = (f) => {
    if (sc === f) setDir(d => d === "asc" ? "desc" : "asc");
    else { setSc(f); setDir("asc"); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height, border: "1px solid #1e293b", borderRadius: 8, overflow: "hidden", background: "#0f172a" }}>
      {/* Filter bar */}
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #1e293b", display: "flex", gap: 8, alignItems: "center", background: "#1e293b", flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input value={q} onChange={e => { setQ(e.target.value); setPage(0); }} placeholder="Search all columns…"
          style={{ border: "none", background: "transparent", outline: "none", fontSize: 13, color: "#e2e8f0", flex: 1, fontFamily: "inherit" }} />
        <span style={{ fontSize: 11, color: "#475569", whiteSpace: "nowrap" }}>{sorted.length} record{sorted.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
            <tr>
              {columns.map(col => (
                <th key={col.field + col.header} onClick={() => col.sortable !== false && toggleSort(col.field)}
                  style={{ padding: "9px 12px", textAlign: "left", fontWeight: 700, fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", color: "#475569", background: "#0f172a", borderBottom: "1px solid #1e293b", cursor: col.sortable !== false ? "pointer" : "default", userSelect: "none", whiteSpace: "nowrap", width: col.width || "auto" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {col.header}
                    {sc === col.field && <span style={{ color: "#6366f1" }}>{dir === "asc" ? "↑" : "↓"}</span>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0
              ? <tr><td colSpan={columns.length} style={{ padding: 32, textAlign: "center", color: "#475569", fontSize: 13 }}>No records found</td></tr>
              : rows.map((row, i) => {
                  const isSelected = selectedId && row.id === selectedId;
                  return (
                    <tr key={i} onClick={() => onRowClick && onRowClick(row)}
                      style={{ background: isSelected ? "rgba(79,70,229,.15)" : i % 2 === 0 ? "#0f172a" : "#0d1829", cursor: onRowClick ? "pointer" : "default", borderBottom: "1px solid #1e293b", transition: "background .1s" }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#1e293b"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isSelected ? "rgba(79,70,229,.15)" : i % 2 === 0 ? "#0f172a" : "#0d1829"; }}
                    >
                      {columns.map(col => (
                        <td key={col.field + col.header} style={{ padding: "8px 12px", color: "#cbd5e1", verticalAlign: "middle" }}>
                          {col.cellRenderer ? col.cellRenderer(row[col.field], row) : (row[col.field] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  );
                })
            }
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ padding: "7px 12px", borderTop: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1e293b", flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: "#475569" }}>Page {page + 1} of {total} · {sorted.length} total</span>
        <div style={{ display: "flex", gap: 3 }}>
          {[["«", 0], ["‹", page - 1], ["›", page + 1], ["»", total - 1]].map(([lbl, tgt]) => {
            const disabled = lbl === "«" || lbl === "‹" ? page === 0 : page === total - 1;
            return (
              <button key={lbl} onClick={() => !disabled && setPage(Math.max(0, Math.min(total - 1, tgt)))}
                style={{ padding: "3px 8px", border: "1px solid #334155", borderRadius: 4, background: "#0f172a", cursor: disabled ? "not-allowed" : "pointer", fontSize: 12, color: "#6366f1", fontFamily: "inherit", opacity: disabled ? .3 : 1 }}>
                {lbl}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
