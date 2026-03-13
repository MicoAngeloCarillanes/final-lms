import React, { useState, useRef } from "react";
import { ALLOWED_MIME_TYPES } from "../../lib/constants";

export default function FileUploadZone({ onFile }) {
  const [dragging, setDragging] = useState(false);
  const [error,    setError]    = useState("");
  const inputRef = useRef(null);

  const validate = (f) => {
    setError("");
    if (!ALLOWED_MIME_TYPES.includes(f.type) && ![".pdf", ".doc", ".docx"].some(e => f.name.endsWith(e))) {
      setError("Only PDF and Word documents are accepted."); return false;
    }
    if (f.size > 20 * 1024 * 1024) { setError("File exceeds 20 MB limit."); return false; }
    return true;
  };
  const handle = (f) => { if (f && validate(f)) onFile(f); };

  return (
    <div>
      <div
        className={`dropzone${dragging ? " drag-over" : ""}`}
        onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files?.[0]); }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
        style={{ padding: "24px 16px", textAlign: "center" }}
      >
        <input ref={inputRef} type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }}
          onChange={e => handle(e.target.files?.[0])} />
        {dragging
          ? <><div style={{ fontSize: 30, marginBottom: 6 }}>⬇</div><div style={{ fontSize: 13, fontWeight: 700, color: "#4f46e5" }}>Drop your file here</div></>
          : <>
              <div style={{ fontSize: 28, marginBottom: 6 }}>☁</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 3 }}>Drag & drop your file</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>or <span style={{ color: "#4f46e5", fontWeight: 700 }}>click to browse</span></div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>PDF, DOC, DOCX · Max 20 MB</div>
            </>
        }
      </div>
      {error && <div style={{ marginTop: 5, fontSize: 11, color: "#ef4444", fontWeight: 600 }}>⚠ {error}</div>}
    </div>
  );
}
