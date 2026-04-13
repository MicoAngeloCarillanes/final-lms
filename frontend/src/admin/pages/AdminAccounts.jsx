import { useCallback, useEffect, useState } from "react";
import * as XLSX from 'xlsx';
import LMSGrid from "../../components/LMSGrid";
import TopBar from "../../components/TopBar";
import { Badge, Btn, FF, Input, Sel } from "../../components/ui";
import SearchableSelect from "../../components/ui/SearchableSelect";
import { programApi, userApi } from "../../lib/api";
import { supabase } from "../../supabaseClient";

// ─── Constants & CSV Configuration ────────────────────────────────────────────
const CIVIL_STATUSES = ["Single", "Married", "Divorced", "Widowed"];
const YEAR_LEVELS    = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const SEMESTERS      = ["1st Semester", "2nd Semester", "Summer"];
const ACCESS_LEVELS  = [1, 2, 3, 4, 5];

const STUDENT_HEADERS = ['fullName', 'email', 'birthdate', 'address', 'civilStatus', 'yearLevel', 'semester', 'programId'];
const TEACHER_HEADERS = ['fullName', 'email', 'birthdate', 'address', 'civilStatus', 'department', 'specialisation'];
const ADMIN_HEADERS   = ['fullName', 'email', 'birthdate', 'address', 'civilStatus', 'accessLevel'];

const headerAliasMap = {
    fullname: 'fullName', name: 'fullName', email: 'email',
    birthdate: 'birthdate', birthday: 'birthdate', dateofbirth: 'birthdate',
    address: 'address', civilstatus: 'civilStatus', civil_status: 'civilStatus',
    yearlevel: 'yearLevel', year_level: 'yearLevel', semester: 'semester',
    programid: 'programId', program_id: 'programId',
    department: 'department', specialisation: 'specialisation', specialization: 'specialisation',
    accesslevel: 'accessLevel', access_level: 'accessLevel'
};

const emptyForm = {
    username: "", fullName: "", email: "", civilStatus: "Single", birthdate: "", address: "",
    yearLevel: "1st Year", semester: "1st Semester", programId: "",
    department: "", specialisation: "", employeeNumber: "", accessLevel: "", 
};

/**
 * Renders a stylized section label for form grouping.
 * @param {Object} props - Component props.
 * @param {React.ReactNode} props.children - Label text.
 */
function SectionLabel({ children }) {
    return (
        <div style={{ fontSize: 10, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", paddingTop: 6 }}>
            {children}
        </div>
    );
}

/**
 * AdminAccounts Component
 * Manages the fetching, creation, updating, and deletion of user accounts with server-side sorting.
 */
export default function AdminAccounts() {
    // 1. States
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [mode, setMode] = useState("create");
    const [role, setRole] = useState("student");
    const [form, setForm] = useState(emptyForm);
    const [editTarget, setEditTarget] = useState(null); 
    const [errors, setErrors] = useState({});
    const [toast, setToast] = useState({ msg: "", type: "success" });
    const [filterRole, setFilterRole] = useState("all");
    const [selId, setSelId] = useState(null); 
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Sorting State
    const [sort, setSort] = useState({ field: "full_name", dir: "asc" });

    // Bulk / Details States
    const [selectedIds, setSelectedIds] = useState([]);
    const [viewingDetails, setViewingDetails] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isBulkLoading, setIsBulkLoading] = useState(false);
    const [deletionImpact, setDeletionImpact] = useState({ enrollments: 0, sections: 0 });

    // Reference Data States
    const [programOpts, setProgramOpts] = useState([]);
    const [deptOpts, setDeptOpts] = useState([]);
    const [takenLevels, setTakenLevels] = useState([]);

    // Bulk Upload States
    const [previewRows, setPreviewRows] = useState([]);
    const [showPreview, setShowPreview] = useState(false);
    const [busy, setBusy] = useState(false); 

    // Password section states
    const [pwOpen, setPwOpen] = useState(false);
    const [pwDefault, setPwDefault] = useState(true);
    const [newPw, setNewPw] = useState("");
    const [confirmPw, setConfirmPw] = useState("");
    const [pwBusy, setPwBusy] = useState(false);

    // 2. Data Fetching Logic (The "Every Mount" and "Every Sort" logic)

    /**
     * Maps UI column fields to actual database columns for sorting.
     */
    const mapSortField = (field) => {
        const mapping = {
            id: 'display_id',
            fullName: 'full_name',
            username: 'username',
            role: 'role',
            email: 'email',
            isActive: 'is_active'
        };
        return mapping[field] || 'full_name';
    };

    /**
     * Fetches fresh user data from Supabase including role-specific details.
     */
    const loadUsers = useCallback(async () => {
        setIsLoading(true);
        try {
            let q = supabase.from("users").select(`
                *,
                students (year_level, semester, program (name)),
                teachers (department, specialisation, employee_number),
                admins (access_level)
            `);

            // Apply Server-side Role Filter
            if (filterRole !== 'all') {
                q = q.eq('role', filterRole);
            }

            // Apply Server-side Sorting
            q = q.order(mapSortField(sort.field), { ascending: sort.dir === 'asc' });

            const { data, error } = await q;

            if (error) throw error;

            // Flatten data for the grid
            const formatted = data.map(u => ({
                ...u,
                _uuid: u.user_id,
                id: u.display_id,
                fullName: u.full_name,
                isActive: u.is_active,
                civilStatus: u.civil_status,
                yearLevel: u.students?.[0]?.year_level,
                semester: u.students?.[0]?.semester,
                programName: u.students?.[0]?.program?.name,
                department: u.teachers?.[0]?.department,
                specialisation: u.teachers?.[0]?.specialisation,
                employeeNumber: u.teachers?.[0]?.employee_number,
                accessLevel: u.admins?.[0]?.access_level
            }));

            setUsers(formatted);
        } catch (err) {
            console.error("Failed to load users:", err);
            showToast("Failed to sync accounts.", "error");
        } finally {
            setIsLoading(false);
        }
    }, [sort, filterRole]);

    useEffect(() => {
        // Fetch users on mount and whenever sort/filter changes
        loadUsers();
        
        // Fetch reference data once on mount
        programApi.getOptions().then(opts => setProgramOpts(opts ?? [])).catch(console.error);
        supabase.from("admins").select("access_level").then(({ data }) => {
            if (data) setTakenLevels(data.map(a => a.access_level));
        });
        supabase.from('department').select('*').then(({ data }) => {
            if (data) setDeptOpts(data);
        }).catch(console.error);
    }, [loadUsers]);

    // 3. Derived Variables & Dropdown Mappings
    const isCreate = mode === "create";
    const availableLevels = ACCESS_LEVELS.filter(lvl => {
        if (!isCreate && Number(editTarget?.accessLevel) === lvl) return true;
        return !takenLevels.includes(lvl);
    });

    const programOptions = programOpts.map(p => ({ label: `${p.code} - ${p.name}`, value: String(p.programId) }));
    const departmentOptions = deptOpts.map(d => {
        const deptName = d.name || d.department_name || d.code || "Unknown";
        return { label: deptName, value: deptName };
    });

    const upd = (f, v) => setForm(p => ({ ...p, [f]: v }));

    const showToast = (msg, type = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast({ msg: "", type: "success" }), 5000);
    };

    // ── Selection & Bulk Deletion Logic ───────────────────────────────────

    function handleSelectAll(e) {
        if (e.target.checked) {
            setSelectedIds(users.map(u => u._uuid));
        } else {
            setSelectedIds([]);
        }
    }

    function toggleSelect(id) {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }

    async function handleOpenDeleteConfirm() {
        if (selectedIds.length === 0) return;
        setIsBulkLoading(true);
        try {
            const { count: enrollCount } = await supabase.from('student_section_assignments').select('*', { count: 'exact', head: true }).in('student_id', selectedIds);
            const { count: sectionCount } = await supabase.from('course_sections').select('*', { count: 'exact', head: true }).in('teacher_id', selectedIds);
            setDeletionImpact({ enrollments: enrollCount || 0, sections: sectionCount || 0 });
            setIsDeleteModalOpen(true);
        } catch (err) {
            console.error("Impact check failed:", err);
        } finally {
            setIsBulkLoading(false);
        }
    }

    async function handleConfirmDelete() {
        setIsBulkLoading(true);
        try {
            const { error } = await supabase.from('users').delete().in('user_id', selectedIds);
            if (error) throw error;
            setUsers(prev => prev.filter(u => !selectedIds.includes(u._uuid)));
            setSelectedIds([]);
            setIsDeleteModalOpen(false);
            showToast(`Deleted ${selectedIds.length} account(s).`, "success");
        } catch (err) {
            showToast(err.message || "Failed to delete accounts.", "error");
        } finally {
            setIsBulkLoading(false);
        }
    }

    // ── CSV & Creation Logic ────────────────────────────────────────────────

    function downloadCsvTemplate() {
        const headers = role === 'student' ? STUDENT_HEADERS : (role === 'teacher' ? TEACHER_HEADERS : ADMIN_HEADERS);
        let sample = role === 'student' 
            ? ['Juan Dela Cruz', 'juan@example.com', '2004-03-12', 'Quezon City', 'Single', '1st Year', '1st Semester', '1']
            : ['Maria Santos', 'maria@example.com', '1990-01-01', 'Quezon City', 'Married', 'Mathematics', 'Algebra'];
        const csvContent = headers.join(',') + '\n' + sample.join(',');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${role}_bulk_template.csv`);
        link.click();
    }

    function handleExportCSV() {
        const headers = ["ID", "Full Name", "Username", "Role", "Email", "Status"];
        const rows = users.map(u => [u.display_id || u.id, u.fullName, u.username, u.role, u.email, u.isActive !== false ? "Active" : "Inactive"]);
        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `accounts_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }

    async function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
                if (raw.length < 2) throw new Error("File is empty.");
                const headers = raw[0].map(h => {
                    const normalized = String(h || '').trim().replace(/\s+/g, '').replace(/_/g, '').toLowerCase();
                    return headerAliasMap[normalized] || String(h).trim();
                });
                const parsed = raw.slice(1).filter(r => r.some(c => c !== '')).map(row => {
                    const obj = {};
                    headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? String(row[i]).trim() : ''; });
                    return obj;
                });
                setPreviewRows(parsed);
                setShowPreview(true);
            } catch (err) {
                showToast(err.message, "error");
            } finally {
                e.target.value = null; 
            }
        };
        reader.readAsBinaryString(file);
    }

    async function handleBulkConfirm() {
        setBusy(true);
        const results = { created: [], failed: [] };
        try {
            const yy = String(new Date().getFullYear()).slice(-2);
            let prefix = role === "student" ? `STU${yy}-` : (role === "teacher" ? `EMP${yy}-` : `ADM`);
            let pad = role === "student" ? 5 : (role === "teacher" ? 4 : 3);
            const { data: maxRow } = await supabase.from("users").select("display_id").ilike("display_id", `${prefix}%`).order("display_id", { ascending: false }).limit(1).maybeSingle();
            let currentNum = maxRow ? parseInt(maxRow.display_id.replace(/^\D+/g, "").replace("-", ""), 10) : 0;
            for (let i = 0; i < previewRows.length; i++) {
                const row = previewRows[i];
                try {
                    if (!row.fullName) throw new Error("Missing full name");
                    currentNum++;
                    const displayId = `${prefix}${String(currentNum).padStart(pad, "0")}`;
                    const autoUsername = displayId.toLowerCase().replace("-", "");
                    const { data: newUser, error: userErr } = await supabase.from("users").insert({ display_id: displayId, username: autoUsername, full_name: row.fullName, email: row.email || null, password_hash: 'PENDING', role, is_active: true, is_verified: false, birthdate: row.birthdate || null, civil_status: row.civilStatus || null, address: row.address || null }).select().single();
                    if (userErr) throw userErr;
                    if (role === "student") await supabase.from("students").insert({ user_id: newUser.user_id, student_id: displayId, year_level: row.yearLevel || "1st Year", semester: row.semester || "1st Semester", program_id: row.programId ? Number(row.programId) : null });
                    else if (role === "teacher") await supabase.from("teachers").insert({ user_id: newUser.user_id, department: row.department || null, specialisation: row.specialisation || null, employee_number: displayId });
                    else if (role === "admin") await supabase.from("admins").insert({ user_id: newUser.user_id, access_level: row.accessLevel ? Number(row.accessLevel) : 1 });
                    if (newUser.email) fetch('http://localhost:3000/api/auth/send-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: newUser.email, fullName: newUser.full_name, username: newUser.username, token: newUser.setup_token }) }).catch(console.error);
                    results.created.push({ ...newUser, ...row });
                } catch (err) {
                    results.failed.push({ name: row.fullName, reason: err.message });
                }
            }
            loadUsers();
            showToast(results.failed.length > 0 ? `Partial success. ${results.failed.length} failed.` : `Success! ${results.created.length} created.`);
        } catch (err) {
            showToast("Critical processing error.", "error");
        } finally {
            setBusy(false); setShowPreview(false); setPreviewRows([]);
        }
    }

        // ── Single Creation & Edit Handlers ─────────────────────────────────────

    function validate(isCreating) {
        const e = {};
        if (!form.fullName.trim()) e.fullName = "Required";
        if (!form.email.trim()) e.email = "Email required";
        if (isCreating && !form.birthdate) e.birthdate = "Required";
        if (role === "admin" && !form.accessLevel) e.accessLevel = "Required";
        return e;
    }

    // ── Single Handlers ────────────────────────────────────────────────────

    async function handleCreate() {
        const e = validate(true);
        if (Object.keys(e).length) { setErrors(e); return; }
        setIsSubmitting(true);
        try {
            const yy = String(new Date().getFullYear()).slice(-2);
            let prefix = role === "student" ? `STU${yy}-` : (role === "teacher" ? `EMP${yy}-` : `ADM`);
            let pad = role === "student" ? 5 : (role === "teacher" ? 4 : 3);
            const { data: maxRow } = await supabase.from("users").select("display_id").ilike("display_id", `${prefix}%`).order("display_id", { ascending: false }).limit(1).maybeSingle();
            const lastNum = maxRow ? parseInt(maxRow.display_id.replace(/^\D+/g, "").replace("-", ""), 10) : 0;
            const generatedDisplayId = `${prefix}${String(lastNum + 1).padStart(pad, "0")}`;
            const autoUsername = generatedDisplayId.toLowerCase().replace("-", "");
            const { data: newUser, error: userErr } = await supabase.from("users").insert({ display_id: generatedDisplayId, username: autoUsername, full_name: form.fullName.trim(), email: form.email.trim(), password_hash: 'PENDING', role, is_active: true, is_verified: false, birthdate: form.birthdate || null, civil_status: form.civilStatus || null, address: form.address.trim() || null }).select().single();
            if (userErr) throw userErr;
            if (role === "student") await supabase.from("students").insert({ user_id: newUser.user_id, student_id: generatedDisplayId, year_level: form.yearLevel, semester: form.semester, program_id: form.programId ? Number(form.programId) : null });
            else if (role === "teacher") await supabase.from("teachers").insert({ user_id: newUser.user_id, department: form.department || null, specialisation: form.specialisation || null, employee_number: generatedDisplayId });
            else if (role === "admin") await supabase.from("admins").insert({ user_id: newUser.user_id, access_level: Number(form.accessLevel) });
            await fetch('http://localhost:3000/api/auth/send-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: newUser.email, fullName: newUser.full_name, username: newUser.username, token: newUser.setup_token }) });
            showToast(`Created ${generatedDisplayId}.`);
            setForm(emptyForm); loadUsers(); 
        } catch (err) {
            showToast(err.message, "error");
        } finally {
            setIsSubmitting(false);
        }
    }

    function handleRowClick(row) {
        setMode("edit"); setEditTarget(row); setSelId(row.id); setRole(row.role);
        setForm({
            username: row.username || "", fullName: row.fullName || "", email: row.email || "", civilStatus: row.civilStatus || "Single", birthdate: row.birthdate || "", address: row.address || "", yearLevel: row.yearLevel || "1st Year", semester: row.semester || "1st Semester", programId: row.programId ? String(row.programId) : "", department: row.department || "", specialisation: row.specialisation || "", employeeNumber: row.employeeNumber || "", accessLevel: row.accessLevel || "",
        });
        setErrors({}); setPwOpen(false);
    }

    function resetToCreate() {
        setMode("create"); setEditTarget(null); setSelId(null); setRole("student"); setForm(emptyForm); setErrors({});
    }

    async function handleSaveEdit() {
        const e = validate(false);
        if (Object.keys(e).length) { setErrors(e); return; }
        const { error: uErr } = await supabase.from("users").update({ full_name: form.fullName.trim(), username: form.username.trim(), email: form.email.trim() || null, civil_status: form.civilStatus || null, birthdate: form.birthdate || null, address: form.address.trim() || null, updated_at: new Date().toISOString() }).eq("user_id", editTarget._uuid);
        if (uErr) { setErrors({ username: "Username taken" }); return; }
        if (editTarget.role === "student") await supabase.from("students").update({ year_level: form.yearLevel, semester: form.semester, program_id: form.programId ? Number(form.programId) : null }).eq("user_id", editTarget._uuid);
        else if (editTarget.role === "teacher") await supabase.from("teachers").update({ department: form.department || null, specialisation: form.specialisation || null }).eq("user_id", editTarget._uuid);
        else if (editTarget.role === "admin") await supabase.from("admins").update({ access_level: Number(form.accessLevel) }).eq("user_id", editTarget._uuid);
        showToast("Updated."); loadUsers();
    }

    async function handleToggleActive() {
        const next = editTarget.isActive === false;
        await supabase.from("users").update({ is_active: next }).eq("user_id", editTarget._uuid);
        setEditTarget(p => ({ ...p, isActive: next }));
        showToast(next ? "Activated." : "Deactivated.");
        loadUsers();
    }

    async function handlePasswordReset() {
        setPwBusy(true);
        try {
            await userApi.resetPassword(editTarget.username, pwDefault ? undefined : newPw);
            showToast("Password reset."); setPwOpen(false);
        } catch (e) { showToast("Reset failed.", "error"); }
        setPwBusy(false);
    }

    // 4. Grid Configuration
    const cols = [
        {
            headerRenderer: () => (
                <input type="checkbox" checked={users.length > 0 && selectedIds.length === users.length} onChange={handleSelectAll} />
            ),
            cellRenderer: (_, row) => (
                <input type="checkbox" checked={selectedIds.includes(row._uuid)} onChange={() => toggleSelect(row._uuid)} onClick={(e) => e.stopPropagation()} />
            ),
            width: 40, sortable: false
        },
        { field: "id", header: "ID", width: 100, sortable: true },
        { field: "fullName", header: "Full Name", width: 160, sortable: true },
        { field: "role", header: "Role", width: 80, sortable: true, cellRenderer: v => <Badge color={v === "teacher" ? "purple" : (v === "admin" ? "warning" : "success")}>{v}</Badge> },
        { field: "email", header: "Email", sortable: true },
        { field: "isActive", header: "Status", width: 85, sortable: true, cellRenderer: v => <Badge color={v !== false ? "success" : "danger"}>{v !== false ? "Active" : "Inactive"}</Badge> },
        {
            header: "Details", width: 70, sortable: false,
            cellRenderer: (_, row) => <Btn size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setViewingDetails(row); }} style={{ padding: '4px 8px' }}>🔍</Btn>
        }
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
            
            {/* Modal: Bulk Delete Confirm */}
            {isDeleteModalOpen && (
                <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1100 }}>
                    <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "450px" }}>
                        <h3 style={{ color: "#ef4444", margin: "0 0 12px 0" }}>Confirm Deletion</h3>
                        <p style={{ color: "#f1f5f9", fontSize: "14px", marginBottom: "16px" }}>Permanently delete <strong>{selectedIds.length}</strong> account(s)?</p>
                        <div style={{ background: "#0f172a", padding: "12px", borderRadius: "6px", border: "1px solid #334155", marginBottom: "20px" }}>
                            <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 800, marginBottom: "8px" }}>Affected Records</div>
                            <div style={{ display: "flex", gap: "16px" }}>
                                <div style={{ flex: 1 }}><div style={{ fontSize: "18px", fontWeight: 700, color: "#f1f5f9" }}>{deletionImpact.enrollments}</div><div style={{ fontSize: "10px", color: "#94a3b8" }}>Enrollments</div></div>
                                <div style={{ flex: 1 }}><div style={{ fontSize: "18px", fontWeight: 700, color: "#f1f5f9" }}>{deletionImpact.sections}</div><div style={{ fontSize: "10px", color: "#94a3b8" }}>Loadings</div></div>
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                            <Btn onClick={() => { setIsDeleteModalOpen(false); setSelectedIds([]); }} variant="secondary">Cancel</Btn>
                            <Btn onClick={handleConfirmDelete} variant="danger">Yes, Delete</Btn>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Account Info */}
            {viewingDetails && (
                <div style={{ alignItems: "center", background: "rgba(0,0,0,0.75)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1200 }}>
                    <div style={{ background: "#1e293b", width: 420, borderRadius: 12, border: "1px solid #334155", padding: "24px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                            <div><h3 style={{ margin: 0, color: "#f1f5f9" }}>{viewingDetails.fullName}</h3><div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{viewingDetails.id} · <Badge color={viewingDetails.role === 'teacher' ? 'purple' : 'success'}>{viewingDetails.role}</Badge></div></div>
                            <button onClick={() => setViewingDetails(null)} style={{ background: "none", border: "none", color: "#64748b", fontSize: 20, cursor: "pointer" }}>×</button>
                        </div>
                        <div style={{ display: "grid", gap: "14px" }}>
                            <FF label="Email"><div style={{ color: "#cbd5e1", fontSize: 13 }}>{viewingDetails.email || "—"}</div></FF>
                            <FF label="Address"><div style={{ color: "#cbd5e1", fontSize: 13 }}>{viewingDetails.address || "No address provided"}</div></FF>
                            {viewingDetails.role === 'student' && <FF label="Academic"><div style={{ color: "#cbd5e1", fontSize: 13 }}>{viewingDetails.yearLevel} · {viewingDetails.semester} · {viewingDetails.programName}</div></FF>}
                            {viewingDetails.role === 'teacher' && <FF label="Department"><div style={{ color: "#cbd5e1", fontSize: 13 }}>{viewingDetails.department || "General"} · {viewingDetails.specialisation}</div></FF>}
                        </div>
                        <Btn variant="secondary" onClick={() => setViewingDetails(null)} style={{ width: "100%", marginTop: 24 }}>Close</Btn>
                    </div>
                </div>
            )}

            {toast.msg && <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, background: "#1e293b", border: `1px solid #334155`, borderRadius: 8, padding: "10px 16px", color: toast.type === "error" ? "#f87171" : "#34d399", fontSize: 13, fontWeight: 600 }}>{toast.msg}</div>}

            <TopBar title="Account Management" subtitle={`Admin · ${users.length} accounts`} actions={
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {selectedIds.length > 0 && <Btn variant="danger" onClick={handleOpenDeleteConfirm} disabled={isBulkLoading}>🗑 Delete Selected ({selectedIds.length})</Btn>}
                    <div style={{ display: "flex", background: "#0f172a", borderRadius: 7, padding: 3, border: "1px solid #334155" }}>
                        {["all", "student", "teacher", "admin"].map(r => (
                            <button key={r} onClick={() => { setFilterRole(r); setSelectedIds([]); }} style={{ padding: "5px 12px", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: filterRole === r ? "#4f46e5" : "transparent", color: filterRole === r ? "#fff" : "#475569" }}>{r}</button>
                        ))}
                    </div>
                    {!isCreate && <Btn onClick={resetToCreate}>➕ New Account</Btn>}
                </div>
            } />

            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                <div style={{ width: 340, borderRight: "1px solid #334155", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", flexShrink: 0, background: "#1e293b" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontWeight: 800, fontSize: 14, color: "#f1f5f9" }}>{isCreate ? "✦ Invite User" : "✏️ Edit Account"}</div>
                        {!isCreate && <button onClick={resetToCreate} style={{ background: "none", border: "none", color: "#475569", fontSize: 18, cursor: "pointer" }}>×</button>}
                    </div>

                    {isCreate && (
                        <div style={{ display: "flex", background: "#0f172a", borderRadius: 8, padding: 3, border: "1px solid #334155" }}>
                            {["student", "teacher", "admin"].map(r => (
                                <button key={r} onClick={() => { setRole(r); setErrors({}); }} style={{ flex: 1, padding: "7px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, background: role === r ? "#1e293b" : "transparent", color: role === r ? "#fff" : "#64748b", boxShadow: role === r ? "0 0 0 1px #6366f1" : "none" }}>{r.charAt(0).toUpperCase() + r.slice(1)}</button>
                            ))}
                        </div>
                    )}

                    <SectionLabel>Personal Info</SectionLabel>
                    <FF label="Full Name" required error={errors.fullName}><Input value={form.fullName} onChange={e => upd("fullName", e.target.value)} /></FF>
                    {!isCreate ? <FF label="Username" required error={errors.username}><Input value={form.username} onChange={e => upd("username", e.target.value)} /></FF> : <div style={{ fontSize: 11, color: "#64748b" }}>💡 Auto-generated from ID</div>}
                    <FF label="Email" required error={errors.email}><Input type="email" value={form.email} onChange={e => upd("email", e.target.value)} /></FF>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <FF label="Civil Status"><Sel value={form.civilStatus} onChange={e => upd("civilStatus", e.target.value)}>{CIVIL_STATUSES.map(s => <option key={s}>{s}</option>)}</Sel></FF>
                        <FF label="Birthdate" required={isCreate} error={errors.birthdate}><Input type="date" value={form.birthdate} onChange={e => upd("birthdate", e.target.value)} /></FF>
                    </div>
                    <FF label="Address"><Input value={form.address} onChange={e => upd("address", e.target.value)} /></FF>

                    {role === "admin" && (
                        <FF label="Access Level" required error={errors.accessLevel}><Sel value={form.accessLevel} onChange={e => upd("accessLevel", e.target.value)}><option value="">— Slot —</option>{availableLevels.map(lvl => <option key={lvl} value={lvl}>Level {lvl}</option>)}</Sel></FF>
                    )}

                    {role === "teacher" && (
                        <>
                            <SectionLabel>Professional Info</SectionLabel>
                            <FF label="Department" style={{ marginBottom: "8px" }}><SearchableSelect options={departmentOptions} value={form.department} onChange={(val) => upd("department", val)} placeholder="Search Department..." /></FF>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                <FF label="Specialty"><Input value={form.specialisation} onChange={e => upd("specialisation", e.target.value)} placeholder="e.g. Physics" /></FF>
                                {!isCreate ? <FF label="Employee No."><Input value={form.employeeNumber} onChange={e => upd("employeeNumber", e.target.value)} /></FF> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', fontSize: 11, color: "#64748b", padding: '8px' }}>💡 Auto-gen.</div>}
                            </div>
                        </>
                    )}

                    {role === "student" && (
                        <>
                            <SectionLabel>Academic Info</SectionLabel>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                <FF label="Year"><Sel value={form.yearLevel} onChange={e => upd("yearLevel", e.target.value)}>{YEAR_LEVELS.map(y => <option key={y}>{y}</option>)}</Sel></FF>
                                <FF label="Semester"><Sel value={form.semester} onChange={e => upd("semester", e.target.value)}>{SEMESTERS.map(s => <option key={s}>{s}</option>)}</Sel></FF>
                            </div>
                            <FF label="Program"><SearchableSelect options={programOptions} value={form.programId} onChange={(val) => upd("programId", val)} placeholder="Search Program..." /></FF>
                        </>
                    )}

                    <div style={{ display: "flex", gap: 8, paddingTop: 2 }}>
                        {isCreate ? (
                            <>
                                <Btn onClick={handleCreate} disabled={isSubmitting || (role === "admin" && availableLevels.length === 0)} style={{ flex: 1 }}>{isSubmitting ? "⏳ Processing..." : "✦ Create Account"}</Btn>
                                <Btn variant="secondary" onClick={resetToCreate}>Reset</Btn>
                            </>
                        ) : (
                            <Btn onClick={handleSaveEdit} style={{ flex: 1 }}>✓ Save Changes</Btn>
                        )}
                    </div>
                    {isCreate && (
                        <div style={{ marginTop: 10, paddingTop: 14, borderTop: "1px solid #334155" }}>
                            <SectionLabel>Bulk Imports ({role})</SectionLabel>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                                <Btn variant="secondary" onClick={downloadCsvTemplate} style={{ fontSize: 11 }}>📥 Get Template</Btn>
                                <div style={{ position: "relative" }}><Btn variant="secondary" style={{ width: "100%", fontSize: 11 }}>📤 Upload CSV</Btn><input type="file" accept=".csv,.xlsx" onChange={handleFileUpload} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} /></div>
                            </div>
                        </div>
                    )}
                    {!isCreate && editTarget && (
                        <div style={{ marginTop: 10, display: "grid", gap: 8, borderTop: "1px solid #334155", paddingTop: 14 }}>
                            <Btn variant="secondary" onClick={() => setPwOpen(!pwOpen)}>🔑 {pwOpen ? "Close Reset" : "Reset Password"}</Btn>
                            {pwOpen && (
                                <div style={{ background: "#0f172a", padding: 10, borderRadius: 8, display: "grid", gap: 8 }}>
                                    {!pwDefault && <><Input type="password" placeholder="New Pw" value={newPw} onChange={e => setNewPw(e.target.value)}/><Input type="password" placeholder="Confirm" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}/></>}
                                    <Btn onClick={handlePasswordReset} disabled={pwBusy} variant="secondary">Confirm Reset</Btn>
                                </div>
                            )}
                            <Btn variant={editTarget.isActive !== false ? "danger" : "success"} onClick={handleToggleActive}>{editTarget.isActive !== false ? "🔴 Deactivate" : "🟢 Reactivate"}</Btn>
                        </div>
                    )}
                </div>

                <div style={{ flex: 1, padding: "14px 18px", display: "flex", flexDirection: "column", background: "#0f172a", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>{users.length} accounts found {!isCreate && <span style={{ color: "#6366f1" }}>— editing {editTarget?.fullName}</span>}</div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <Btn variant="secondary" onClick={() => { setSort({ field: 'full_name', dir: 'asc' }); loadUsers(); }} style={{ padding: "4px 10px", fontSize: 11 }}>🔄 Refresh</Btn>
                            <Btn variant="secondary" onClick={handleExportCSV} style={{ padding: "4px 10px", fontSize: 11 }}>📊 Export CSV</Btn>
                        </div>
                    </div>
                    <div style={{ flex: 1, overflow: "hidden" }}>
                        <LMSGrid 
                            columns={cols} 
                            rowData={users} 
                            onRowClick={handleRowClick} 
                            selectedId={selId} 
                            height="100%"
                            onSortChange={(f, d) => setSort({ field: f, dir: d })}
                            sortField={sort.field}
                            sortDir={sort.dir}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}