/**
 * TeacherAttendance.jsx
 * FOLDER: src/teacher/pages/TeacherAttendance.jsx
 *
 * Session-based attendance. Teacher picks a course, date, and term,
 * then marks Present/Late/Absent/Excused per enrolled student.
 * Works for face-to-face AND online classes.
 *
 * Views:  "take" | "history" | "summary"
 */
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../supabaseClient";
import { Btn, Sel, FF, Input } from "../../components/ui";
import TopBar from "../../components/TopBar";

const TERMS    = ["Prelim", "Midterm", "Semi-Final", "Finals"];
const STATUSES = ["Present", "Late", "Absent", "Excused"];

const SS = {
  Present: { bg: "rgba(16,185,129,.2)",  color: "#34d399", border: "rgba(16,185,129,.4)"  },
  Late:    { bg: "rgba(245,158,11,.2)",  color: "#fbbf24", border: "rgba(245,158,11,.4)"  },
  Absent:  { bg: "rgba(239,68,68,.2)",   color: "#f87171", border: "rgba(239,68,68,.4)"   },
  Excused: { bg: "rgba(100,116,139,.2)", color: "#94a3b8", border: "rgba(100,116,139,.4)" },
};
const SI = { Present: "✓", Late: "⏰", Absent: "✗", Excused: "〇" };
const TC = { Prelim: "#a5b4fc", Midterm: "#60a5fa", "Semi-Final": "#fbbf24", Finals: "#f87171" };

export default function TeacherAttendance({ user, courses, enrollments, allUsers }) {
  const myCourses = courses.filter(c => c.teacher === user.id);

  const [view,      setView]      = useState("take");
  const [selCourse, setSelCourse] = useState(myCourses[0]?.id || "");

  // take-attendance
  const [sessDate,    setSessDate]    = useState(new Date().toISOString().slice(0,10));
  const [term,        setTerm]        = useState("Prelim");
  const [sessLabel,   setSessLabel]   = useState("");
  const [dAbsent,     setDAbsent]     = useState(5);
  const [dLate,       setDLate]       = useState(2.5);
  const [activeSessId,setActiveSessId]= useState(null);
  const [records,     setRecords]     = useState({});
  const [loadingS,    setLoadingS]    = useState(false);
  const [saving,      setSaving]      = useState(false);

  // history
  const [sessions,    setSessions]    = useState([]);
  const [loadingH,    setLoadingH]    = useState(false);
  const [expandedS,   setExpandedS]   = useState(null);
  const [sessRecs,    setSessRecs]    = useState({});

  // summary
  const [sumTerm,     setSumTerm]     = useState("Prelim");
  const [summary,     setSummary]     = useState([]);
  const [loadingSu,   setLoadingSu]   = useState(false);

  const [toast,    setToast]    = useState("");
  const [toastErr, setToastErr] = useState("");
  const ok  = m => { setToast(m);    setTimeout(()=>setToast(""),   3000); };
  const err = m => { setToastErr(m); setTimeout(()=>setToastErr(""),4000); };

  const course     = myCourses.find(c => c.id === selCourse);
  const courseUuid = course?._uuid;
  const enrolled   = enrollments.filter(e => e.courseId === selCourse);
  const students   = enrolled.map(e => allUsers.find(u => u.id===e.studentId || u._uuid===e.studentId)).filter(Boolean);

  // init records to Absent
  const initRec = useCallback(() => {
    const m = {};
    students.forEach(s => { m[s._uuid||s.id] = "Absent"; });
    setRecords(m);
  }, [students.length, selCourse]);

  // load session for date+term
  const loadSession = useCallback(async () => {
    if (!courseUuid) return;
    setLoadingS(true);
    const { data: sess } = await supabase
      .from("attendance_sessions")
      .select("session_id,label,deduct_absent,deduct_late")
      .eq("course_id", courseUuid).eq("session_date", sessDate).eq("term", term)
      .maybeSingle();
    if (sess) {
      setActiveSessId(sess.session_id);
      setSessLabel(sess.label||"");
      setDAbsent(sess.deduct_absent);
      setDLate(sess.deduct_late);
      const { data: recs } = await supabase
        .from("attendance_records").select("student_id,status").eq("session_id", sess.session_id);
      const m = {}; students.forEach(s=>{ m[s._uuid||s.id]="Absent"; });
      (recs||[]).forEach(r=>{ m[r.student_id]=r.status; });
      setRecords(m);
    } else {
      setActiveSessId(null); setSessLabel(""); initRec();
    }
    setLoadingS(false);
  }, [courseUuid, sessDate, term, students.length]);

  useEffect(()=>{ if(view==="take") loadSession(); },[courseUuid,sessDate,term,view]);

  // load history
  const loadHistory = useCallback(async () => {
    if (!courseUuid) return;
    setLoadingH(true);
    const { data } = await supabase.from("attendance_sessions")
      .select("session_id,session_date,label,term,deduct_absent,deduct_late")
      .eq("course_id", courseUuid).order("session_date",{ascending:false});
    setSessions(data||[]);
    setLoadingH(false);
  }, [courseUuid]);

  useEffect(()=>{ if(view==="history") loadHistory(); },[view,courseUuid]);

  // load summary
  const loadSummary = useCallback(async () => {
    if (!courseUuid) return;
    setLoadingSu(true);
    const { data: sessList } = await supabase.from("attendance_sessions")
      .select("session_id,deduct_absent,deduct_late")
      .eq("course_id",courseUuid).eq("term",sumTerm);
    if (!sessList?.length) { setSummary([]); setLoadingSu(false); return; }
    const ids = sessList.map(s=>s.session_id);
    const { data: recs } = await supabase.from("attendance_records")
      .select("student_id,status,session_id").in("session_id",ids);
    const avgDA = sessList.reduce((a,b)=>a+b.deduct_absent,0)/sessList.length;
    const avgDL = sessList.reduce((a,b)=>a+b.deduct_late,  0)/sessList.length;
    const sm = {};
    students.forEach(s => {
      const uid=s._uuid||s.id;
      sm[uid]={ uid, displayId:s.id, name:s.fullName||s.name||s.id, p:0, a:0, l:0, e:0 };
    });
    (recs||[]).forEach(r => {
      if(!sm[r.student_id]) return;
      const st=r.status;
      if(st==="Present") sm[r.student_id].p++;
      else if(st==="Absent")  sm[r.student_id].a++;
      else if(st==="Late")    sm[r.student_id].l++;
      else if(st==="Excused") sm[r.student_id].e++;
    });
    setSummary(Object.values(sm).map(s=>({
      ...s, total:sessList.length,
      pct: Math.max(0, Math.round(100-(s.a*avgDA)-(s.l*avgDL))),
    })));
    setLoadingSu(false);
  }, [courseUuid, sumTerm, students.length]);

  useEffect(()=>{ if(view==="summary") loadSummary(); },[view,courseUuid,sumTerm]);

  // save
  const handleSave = async () => {
    if (!courseUuid) return;
    setSaving(true);
    let sid = activeSessId;
    if (!sid) {
      const { data, error } = await supabase.from("attendance_sessions")
        .insert({ course_id:courseUuid, session_date:sessDate, label:sessLabel.trim()||null,
          term, deduct_absent:Number(dAbsent), deduct_late:Number(dLate),
          created_by:user._uuid||user.id })
        .select("session_id").single();
      if (error) { err("Failed to create session: "+error.message); setSaving(false); return; }
      sid=data.session_id; setActiveSessId(sid);
    } else {
      await supabase.from("attendance_sessions")
        .update({ deduct_absent:Number(dAbsent), deduct_late:Number(dLate), label:sessLabel.trim()||null })
        .eq("session_id",sid);
    }
    const rows = Object.entries(records).map(([student_id,status])=>({ session_id:sid, student_id, status }));
    const { error } = await supabase.from("attendance_records")
      .upsert(rows,{ onConflict:"session_id,student_id" });
    setSaving(false);
    if (error) { err("Failed to save: "+error.message); return; }
    ok(`Attendance saved for ${students.length} students.`);
  };

  const expandSession = async (sessionId) => {
    if (expandedS===sessionId) { setExpandedS(null); return; }
    setExpandedS(sessionId);
    const { data } = await supabase.from("attendance_records")
      .select("student_id,status").eq("session_id",sessionId);
    const m={}; (data||[]).forEach(r=>{ m[r.student_id]=r.status; });
    setSessRecs(m);
  };

  const markAll = st => {
    const m={}; students.forEach(s=>{ m[s._uuid||s.id]=st; }); setRecords(m);
  };

  const counts = students.reduce((a,s)=>{
    const st=records[s._uuid||s.id]||"Absent"; a[st]=(a[st]||0)+1; return a;
  },{});

  const ViewBtn = ({id,label}) => (
    <button onClick={()=>setView(id)} style={{
      padding:"7px 14px", borderRadius:6, fontFamily:"inherit", fontSize:13, fontWeight:700, cursor:"pointer",
      background:view===id?"#4f46e5":"transparent", color:view===id?"#fff":"#64748b",
      border:view===id?"none":"1px solid #334155",
    }}>{label}</button>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      <TopBar title="Attendance" icon="✅" />

      {(toast||toastErr) && (
        <div style={{padding:"8px 20px 0"}}>
          <div style={{
            background:toast?"rgba(16,185,129,.12)":"rgba(239,68,68,.12)",
            border:`1px solid ${toast?"rgba(16,185,129,.3)":"rgba(239,68,68,.3)"}`,
            borderRadius:8,padding:"9px 14px",
            color:toast?"#34d399":"#f87171",fontSize:13,fontWeight:600,
          }}>{toast||toastErr}</div>
        </div>
      )}

      <div style={{padding:"12px 20px",borderBottom:"1px solid #1e293b",display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
        <Sel value={selCourse} onChange={e=>setSelCourse(e.target.value)} style={{width:220}}>
          {myCourses.map(c=><option key={c.id} value={c.id}>{c.code}: {c.name}</option>)}
        </Sel>
        <ViewBtn id="take"    label="📋 Take Attendance" />
        <ViewBtn id="history" label="📂 Session History" />
        <ViewBtn id="summary" label="📊 Summary" />
      </div>

      {/* ── TAKE ── */}
      {view==="take" && (
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{padding:"10px 20px",background:"#1e293b",borderBottom:"1px solid #334155",display:"flex",gap:12,flexWrap:"wrap",alignItems:"flex-end"}}>
            <FF label="Date"><Input type="date" value={sessDate} onChange={e=>setSessDate(e.target.value)} style={{width:155}}/></FF>
            <FF label="Term">
              <Sel value={term} onChange={e=>setTerm(e.target.value)} style={{width:145}}>
                {TERMS.map(t=><option key={t} value={t}>{t}</option>)}
              </Sel>
            </FF>
            <FF label="Session Label"><Input value={sessLabel} onChange={e=>setSessLabel(e.target.value)} placeholder="e.g. Week 3 Monday" style={{width:200}}/></FF>
            <FF label="Absent Deduct (%)"><Input type="number" min={0} max={100} value={dAbsent} onChange={e=>setDAbsent(e.target.value)} style={{width:80}}/></FF>
            <FF label="Late Deduct (%)"><Input type="number" min={0} max={100} value={dLate} onChange={e=>setDLate(e.target.value)} style={{width:80}}/></FF>
            {activeSessId && <div style={{fontSize:11,color:"#34d399",background:"rgba(16,185,129,.1)",border:"1px solid rgba(16,185,129,.25)",borderRadius:5,padding:"3px 8px",fontWeight:700}}>✓ Session exists</div>}
          </div>

          {students.length>0 && (
            <div style={{padding:"8px 20px",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
              {STATUSES.map(st=>{
                const s=SS[st];
                return(
                  <div key={st} style={{background:s.bg,borderRadius:6,padding:"4px 12px",display:"flex",alignItems:"center",gap:5}}>
                    <span style={{color:s.color,fontWeight:800,fontSize:13}}>{SI[st]}</span>
                    <span style={{color:s.color,fontSize:12,fontWeight:700}}>{counts[st]||0}</span>
                    <span style={{color:s.color,fontSize:11,opacity:.8}}>{st}</span>
                  </div>
                );
              })}
              <div style={{marginLeft:"auto",display:"flex",gap:6}}>
                {STATUSES.map(st=>(
                  <Btn key={st} size="sm" variant="secondary" onClick={()=>markAll(st)} style={{fontSize:11}}>
                    All {SI[st]}
                  </Btn>
                ))}
              </div>
            </div>
          )}

          <div style={{flex:1,overflowY:"auto",padding:"8px 20px 20px"}}>
            {loadingS && <div style={{color:"#475569",textAlign:"center",marginTop:40}}>Loading…</div>}
            {!loadingS && students.length===0 && <div style={{color:"#475569",textAlign:"center",marginTop:40,fontSize:13}}>No students enrolled.</div>}
            {!loadingS && students.map((stu,idx)=>{
              const uid    = stu._uuid||stu.id;
              const status = records[uid]||"Absent";
              const s      = SS[status];
              return(
                <div key={uid} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:8,marginBottom:6,background:"#1e293b",border:`1px solid ${status!=="Absent"?s.border:"#1e293b"}`,transition:"border-color .15s"}}>
                  <div style={{width:28,height:28,borderRadius:"50%",background:"#0f172a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#475569",flexShrink:0}}>{idx+1}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#e2e8f0",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{stu.fullName||stu.name||stu.id}</div>
                    <div style={{fontSize:11,color:"#475569"}}>{stu.id}</div>
                  </div>
                  <div style={{display:"flex",gap:5,flexShrink:0}}>
                    {STATUSES.map(st=>{
                      const cs=SS[st]; const active=status===st;
                      return(
                        <button key={st} onClick={()=>setRecords(p=>({...p,[uid]:st}))} style={{
                          padding:"5px 10px",borderRadius:6,fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer",
                          background:active?cs.bg:"transparent",color:active?cs.color:"#475569",
                          border:active?`1px solid ${cs.border}`:"1px solid #334155",transition:"all .12s",
                        }}>{SI[st]} {st}</button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {students.length>0 && (
            <div style={{padding:"12px 20px",borderTop:"1px solid #1e293b",display:"flex",gap:10}}>
              <Btn onClick={handleSave} disabled={saving} variant="success" size="lg">
                {saving?"Saving…":`💾 Save Attendance (${students.length} students)`}
              </Btn>
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY ── */}
      {view==="history" && (
        <div style={{flex:1,overflowY:"auto",padding:20}}>
          {loadingH && <div style={{color:"#475569",textAlign:"center",marginTop:40}}>Loading…</div>}
          {!loadingH && sessions.length===0 && <div style={{color:"#475569",textAlign:"center",marginTop:60,fontSize:13}}>No sessions recorded yet.</div>}
          {sessions.map(s=>{
            const isOpen=expandedS===s.session_id;
            return(
              <div key={s.session_id} style={{background:"#1e293b",border:"1px solid #334155",borderRadius:10,marginBottom:10,overflow:"hidden"}}>
                <div style={{padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12}} onClick={()=>expandSession(s.session_id)}>
                  <span style={{fontSize:20}}>📅</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:800,fontSize:13,color:"#f1f5f9"}}>
                      {s.session_date}
                      {s.label&&<span style={{color:"#64748b",fontWeight:400,marginLeft:8}}>— {s.label}</span>}
                    </div>
                    <div style={{display:"flex",gap:6,marginTop:4}}>
                      <span style={{fontSize:11,color:TC[s.term]||"#94a3b8",fontWeight:700}}>{s.term}</span>
                      <span style={{fontSize:11,color:"#475569"}}>Deduct: {s.deduct_absent}% absent · {s.deduct_late}% late</span>
                    </div>
                  </div>
                  <span style={{color:"#475569",fontSize:18}}>{isOpen?"▲":"▼"}</span>
                </div>
                {isOpen && (
                  <div style={{borderTop:"1px solid #334155",padding:"12px 16px"}}>
                    {Object.keys(sessRecs).length===0
                      ? <div style={{color:"#475569",fontSize:13}}>No records.</div>
                      : students.map(stu=>{
                          const uid=stu._uuid||stu.id;
                          const st=sessRecs[uid];
                          const sty=SS[st]||{};
                          return(
                            <div key={uid} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:"1px solid #1e293b"}}>
                              <div style={{flex:1,fontSize:13,color:"#cbd5e1"}}>{stu.fullName||stu.id}</div>
                              {st
                                ?<span style={{background:sty.bg,color:sty.color,padding:"2px 10px",borderRadius:6,fontSize:12,fontWeight:700}}>{SI[st]} {st}</span>
                                :<span style={{color:"#475569",fontSize:12}}>—</span>
                              }
                            </div>
                          );
                        })
                    }
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── SUMMARY ── */}
      {view==="summary" && (
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{padding:"10px 20px",borderBottom:"1px solid #1e293b",display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontSize:12,color:"#64748b"}}>Term:</span>
            {TERMS.map(t=>(
              <button key={t} onClick={()=>setSumTerm(t)} style={{
                padding:"5px 12px",borderRadius:6,fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer",
                background:sumTerm===t?"#4f46e5":"transparent",
                color:sumTerm===t?"#fff":"#64748b",
                border:sumTerm===t?"none":"1px solid #334155",
              }}>{t}</button>
            ))}
          </div>
          <div style={{flex:1,overflowY:"auto",padding:20}}>
            {loadingSu && <div style={{color:"#475569",textAlign:"center",marginTop:40}}>Loading…</div>}
            {!loadingSu && summary.length===0 && <div style={{color:"#475569",textAlign:"center",marginTop:60,fontSize:13}}>No sessions for {sumTerm} yet.</div>}
            {!loadingSu && summary.length>0 && (
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead>
                  <tr style={{borderBottom:"1px solid #334155"}}>
                    {["Student","Sessions","Present","Late","Absent","Excused","Attendance %"].map(h=>(
                      <th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:10,fontWeight:800,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".06em"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.map(s=>{
                    const c=s.pct>=90?"#34d399":s.pct>=75?"#60a5fa":s.pct>=60?"#fbbf24":"#f87171";
                    return(
                      <tr key={s.uid} style={{borderBottom:"1px solid #1e293b"}}>
                        <td style={{padding:"10px 12px"}}>
                          <div style={{fontWeight:700,color:"#e2e8f0"}}>{s.name}</div>
                          <div style={{fontSize:11,color:"#475569"}}>{s.displayId}</div>
                        </td>
                        <td style={{padding:"10px 12px",color:"#94a3b8"}}>{s.total}</td>
                        <td style={{padding:"10px 12px",color:"#34d399",fontWeight:700}}>{s.p}</td>
                        <td style={{padding:"10px 12px",color:"#fbbf24",fontWeight:700}}>{s.l}</td>
                        <td style={{padding:"10px 12px",color:"#f87171",fontWeight:700}}>{s.a}</td>
                        <td style={{padding:"10px 12px",color:"#94a3b8"}}>{s.e}</td>
                        <td style={{padding:"10px 12px"}}>
                          <span style={{background:`${c}22`,color:c,padding:"3px 10px",borderRadius:6,fontWeight:800,fontSize:13}}>{s.pct}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
