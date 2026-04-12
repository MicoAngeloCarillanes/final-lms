import { useRef, useState } from 'react';
import LMSGrid from '../../../../components/LMSGrid';
import { Btn, Input } from '../../../../components/ui';
import useFacilitiesData from '../hooks/useFacilitiesData';

const DAYS_SHORT = ["M", "T", "W", "Th", "F", "S", "Su"];

/**
 * FacilitiesTab
 * * Logic: Manage campus Rooms and Schedule patterns with Bulk CSV, Usage insights, and Exporting.
 * * UI: Horizontal layout (stacked vertically) with server-side sorting.
 */
export default function FacilitiesTab() {
    const [roomSort, setRoomSort] = useState<{ field: string; dir: 'asc' | 'desc' }>({ field: 'room_name', dir: 'asc' });
    const [schedSort, setSchedSort] = useState<{ field: string; dir: 'asc' | 'desc' }>({ field: 'schedule_label', dir: 'asc' });

    const { 
        rooms, schedules, isLoading, 
        addRoom, bulkAddRooms, deleteRooms, 
        addSchedule, bulkAddSchedules, deleteSchedules,
        getUsage 
    } = useFacilitiesData(roomSort, schedSort);

    // UI State: Selection & Modals
    const [selRooms, setSelRooms] = useState<string[]>([]);
    const [selScheds, setSelScheds] = useState<string[]>([]);
    const [confirmAction, setConfirmAction] = useState<{ type: string; ids: string[]; msg: string } | null>(null);
    const [usageDetail, setUsageDetail] = useState<{ title: string; data: any[] } | null>(null);
    const [bulkModal, setBulkModal] = useState<'room' | 'schedule' | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form States
    const [roomForm, setRoomForm] = useState({ capacity: 40, name: "" });
    const [schedForm, setSchedForm] = useState({ days: [] as string[], startTime: "07:30", endTime: "09:00" });

    // Formatting & Helpers
    function formatTimeLabel(timeStr: string) {
        if (!timeStr) return "";
        const [h, m] = timeStr.split(':');
        let hour = parseInt(h);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12 || 12;
        return `${hour}:${m} ${ampm}`;
    }

    async function handleAddRoom() {
        if (!roomForm.name) return;
        const { error } = await addRoom(roomForm.name, roomForm.capacity);
        if (!error) setRoomForm({ capacity: 40, name: "" });
    }

    async function handleAddSchedule() {
        if (schedForm.days.length === 0 || !schedForm.startTime || !schedForm.endTime) return;
        const dayPattern = schedForm.days.join("");
        const fullLabel = `${dayPattern} ${formatTimeLabel(schedForm.startTime)} - ${formatTimeLabel(schedForm.endTime)}`;
        const { error } = await addSchedule({ label: fullLabel, days: dayPattern, startTime: schedForm.startTime, endTime: schedForm.endTime });
        if (!error) setSchedForm({ days: [], startTime: "07:30", endTime: "09:00" });
    }

    /**
     * showUsage
     * FIX: Passes the schedule_label for schedule lookups as sections are linked by label.
     */
    async function showUsage(type: 'room' | 'schedule', item: any) {
        const identifier = type === 'room' ? item.room_id : item.schedule_label;
        const { data } = await getUsage(type, identifier);
        setUsageDetail({ 
            title: `Usage for: ${type === 'room' ? item.room_name : item.schedule_label}`,
            data: data || [] 
        });
    }

    // CSV Logic
    function downloadTemplate(type: 'room' | 'schedule') {
        const content = type === 'room' ? "room_name,capacity\nRoom 101,45" : "days,start_time,end_time\nMWF,07:30,09:00";
        const blob = new Blob([content], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Template_${type}.csv`;
        link.click();
    }

    function handleExport(type: 'room' | 'schedule') {
        let content = "";
        if (type === 'room') {
            content = "Room Name,Capacity\n" + rooms.map(r => `"${r.room_name}",${r.capacity}`).join("\n");
        } else {
            content = "Schedule Label,Days,Start,End\n" + schedules.map(s => `"${s.schedule_label}","${s.day_pattern}","${s.time_start}","${s.time_end}"`).join("\n");
        }
        const blob = new Blob([content], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Export_${type}s.csv`;
        link.click();
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, type: 'room' | 'schedule') {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const lines = (event.target?.result as string).split('\n').filter(l => l.trim());
            const dataRows = lines.slice(1);
            if (type === 'room') {
                const payload = dataRows.map(line => {
                    const [name, cap] = line.split(',');
                    return { room_name: name.trim(), capacity: parseInt(cap) || 40 };
                });
                await bulkAddRooms(payload);
            } else {
                const payload = dataRows.map(line => {
                    const [days, start, end] = line.split(',');
                    const label = `${days} ${formatTimeLabel(start.trim())} - ${formatTimeLabel(end.trim())}`;
                    return { day_pattern: days.trim(), time_start: start.trim(), time_end: end.trim(), schedule_label: label };
                });
                await bulkAddSchedules(payload);
            }
            setBulkModal(null);
        };
        reader.readAsText(file);
    }

    const roomCols = [
        {
            headerRenderer: () => (
                <input type="checkbox" checked={rooms.length > 0 && selRooms.length === rooms.length} 
                    onChange={e => setSelRooms(e.target.checked ? rooms.map(r => r.room_id) : [])} />
            ),
            cellRenderer: (_: any, row: any) => (
                <input type="checkbox" checked={selRooms.includes(row.room_id)} 
                    onChange={() => setSelRooms(p => p.includes(row.room_id) ? p.filter(id => id !== row.room_id) : [...p, row.room_id])} />
            ),
            width: 40, sortable: false
        },
        { field: "room_name", header: "Room Name", flex: 1, sortable: true },
        { field: "capacity", header: "Capacity", width: 120, sortable: true },
        { 
            cellRenderer: (_: any, row: any) => (
                <div style={{ display: "flex", gap: "8px" }}>
                    <Btn size="sm" variant="secondary" onClick={() => showUsage('room', row)}>Details</Btn>
                    <Btn size="sm" variant="danger" onClick={() => setConfirmAction({ type: 'room', ids: [row.room_id], msg: `Delete ${row.room_name}?` })}>Remove</Btn>
                </div>
            ), 
            width: 110, sortable: false
        }
    ];

    const schedCols = [
        {
            headerRenderer: () => (
                <input type="checkbox" checked={schedules.length > 0 && selScheds.length === schedules.length} 
                    onChange={e => setSelScheds(e.target.checked ? schedules.map(s => s.schedule_id) : [])} />
            ),
            cellRenderer: (_: any, row: any) => (
                <input type="checkbox" checked={selScheds.includes(row.schedule_id)} 
                    onChange={() => setSelScheds(p => p.includes(row.schedule_id) ? p.filter(id => id !== row.schedule_id) : [...p, row.schedule_id])} />
            ),
            width: 40, sortable: false
        },
        { field: "schedule_label", header: "Schedule Block", flex: 1, sortable: true },
        { 
            cellRenderer: (_: any, row: any) => (
                <div style={{ display: "flex", gap: "8px" }}>
                    <Btn size="sm" variant="secondary" onClick={() => showUsage('schedule', row)}>Details</Btn>
                    <Btn size="sm" variant="danger" onClick={() => setConfirmAction({ type: 'schedule', ids: [row.schedule_id], msg: 'Delete schedule block?' })}>Remove</Btn>
                </div>
            ), 
            width: 110, sortable: false
        }
    ];

    return (
        <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: "24px", padding: "24px", position: "relative", overflowY: "auto" }}>
            
            {/* SCHEDULES PANEL (TOP) */}
            <div style={{ background: "#1e293b", borderRadius: "8px", display: "flex", flexDirection: "column", padding: "20px", minHeight: "400px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", alignItems: "center" }}>
                    <h3 style={{ color: "#f1f5f9", margin: 0 }}>Manage Schedules</h3>
                    <div style={{ display: "flex", gap: "8px" }}>
                        {selScheds.length > 0 && <Btn variant="danger" size="sm" onClick={() => setConfirmAction({ type: 'schedule', ids: selScheds, msg: `Delete ${selScheds.length} schedules?` })}>Delete Selected</Btn>}
                        <Btn variant="secondary" size="sm" onClick={() => handleExport('schedule')}>Export CSV</Btn>
                        <Btn variant="secondary" size="sm" onClick={() => setBulkModal('schedule')}>Bulk Upload</Btn>
                    </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px", maxWidth: "600px" }}>
                    <div style={{ display: "flex", gap: "4px" }}>
                        {DAYS_SHORT.map(day => (
                            <button key={day} onClick={() => setSchedForm(p => ({...p, days: p.days.includes(day) ? p.days.filter(d => d !== day) : [...p.days, day]}))}
                                style={{ background: schedForm.days.includes(day) ? "#3b82f6" : "#0f172a", border: "1px solid #334155", borderRadius: "4px", color: "#f1f5f9", flex: 1, fontSize: "11px", padding: "10px 0", cursor: "pointer" }}>{day}</button>
                        ))}
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                        <Input type="time" style={{ flex: 1 }} value={schedForm.startTime} onChange={e => setSchedForm({...schedForm, startTime: e.target.value})} />
                        <Input type="time" style={{ flex: 1 }} value={schedForm.endTime} onChange={e => setSchedForm({...schedForm, endTime: e.target.value})} />
                        <Btn onClick={handleAddSchedule} disabled={isLoading}>Add Schedule</Btn>
                    </div>
                </div>
                <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", flex: 1, overflow: "hidden" }}>
                    <LMSGrid 
                        columns={schedCols} 
                        height="100%" 
                        rowData={schedules} 
                        onSortChange={(field, dir) => setSchedSort({ field, dir: dir as 'asc' | 'desc' })}
                        sortField={schedSort.field}
                        sortDir={schedSort.dir}
                    />
                </div>
            </div>

            {/* ROOMS PANEL (BOTTOM) */}
            <div style={{ background: "#1e293b", borderRadius: "8px", display: "flex", flexDirection: "column", padding: "20px", minHeight: "400px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", alignItems: "center" }}>
                    <h3 style={{ color: "#f1f5f9", margin: 0 }}>Campus Rooms</h3>
                    <div style={{ display: "flex", gap: "8px" }}>
                        {selRooms.length > 0 && <Btn variant="danger" size="sm" onClick={() => setConfirmAction({ type: 'room', ids: selRooms, msg: `Delete ${selRooms.length} rooms?` })}>Delete Selected</Btn>}
                        <Btn variant="secondary" size="sm" onClick={() => handleExport('room')}>Export CSV</Btn>
                        <Btn variant="secondary" size="sm" onClick={() => setBulkModal('room')}>Bulk Upload</Btn>
                    </div>
                </div>
                <div style={{ display: "flex", gap: "8px", marginBottom: "16px", maxWidth: "600px" }}>
                    <Input placeholder="Room Name" style={{ flex: 1 }} value={roomForm.name} onChange={e => setRoomForm({ ...roomForm, name: e.target.value })} />
                    <Input type="number" placeholder="Capacity" style={{ width: "120px" }} value={roomForm.capacity} onChange={e => setRoomForm({ ...roomForm, capacity: Number(e.target.value) })} />
                    <Btn onClick={handleAddRoom} disabled={isLoading}>Add Room</Btn>
                </div>
                <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", flex: 1, overflow: "hidden" }}>
                    <LMSGrid 
                        columns={roomCols} 
                        height="100%" 
                        rowData={rooms} 
                        onSortChange={(field, dir) => setRoomSort({ field, dir: dir as 'asc' | 'desc' })}
                        sortField={roomSort.field}
                        sortDir={roomSort.dir}
                    />
                </div>
            </div>

            {/* CONFIRMATION MODAL */}
            {confirmAction && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
                    <div style={{ background: "#1e293b", padding: "32px", borderRadius: "12px", width: "400px", textAlign: "center", border: "1px solid #334155" }}>
                        <h3 style={{ color: "#f87171", margin: "0 0 12px 0" }}>Destructive Action</h3>
                        <p style={{ color: "#cbd5e1", fontSize: "14px", margin: "0 0 24px 0" }}>{confirmAction.msg}</p>
                        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                            <Btn variant="secondary" onClick={() => setConfirmAction(null)}>Cancel</Btn>
                            <Btn variant="danger" onClick={async () => {
                                if (confirmAction.type === 'room') { await deleteRooms(confirmAction.ids); setSelRooms([]); }
                                else { await deleteSchedules(confirmAction.ids); setSelScheds([]); }
                                setConfirmAction(null);
                            }}>Confirm Delete</Btn>
                        </div>
                    </div>
                </div>
            )}

            {/* USAGE DETAILS MODAL */}
            {usageDetail && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
                    <div style={{ background: "#1e293b", padding: "24px", borderRadius: "12px", width: "600px", border: "1px solid #334155" }}>
                        <h3 style={{ color: "#f1f5f9", marginTop: 0, marginBottom: "16px" }}>{usageDetail.title}</h3>
                        <div style={{ background: "#0f172a", borderRadius: "6px", padding: "16px", maxHeight: "400px", overflowY: "auto", border: "1px solid #334155" }}>
                            {usageDetail.data.length > 0 ? usageDetail.data.map((sec, i) => (
                                <div key={i} style={{ padding: "12px", borderBottom: i !== usageDetail.data.length - 1 ? "1px solid #1e293b" : "none", color: "#e2e8f0", fontSize: "13px" }}>
                                    <span style={{ color: "#3b82f6", fontWeight: 700 }}>{sec.courses.course_code}</span>: {sec.section_label} 
                                    <span style={{ color: "#64748b", marginLeft: "8px" }}>— {sec.academic_blocks.block_name}</span>
                                </div>
                            )) : <p style={{ color: "#64748b", textAlign: "center", padding: "20px" }}>No course sections are currently using this facility.</p>}
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "24px" }}>
                            <Btn onClick={() => setUsageDetail(null)}>Close</Btn>
                        </div>
                    </div>
                </div>
            )}

            {/* BULK UPLOAD MODAL */}
            {bulkModal && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
                    <div style={{ background: "#1e293b", padding: "32px", borderRadius: "12px", width: "450px", border: "1px solid #334155" }}>
                        <h3 style={{ color: "#f1f5f9", margin: "0 0 8px 0" }}>Bulk Upload: {bulkModal === 'room' ? 'Rooms' : 'Schedules'}</h3>
                        <p style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "24px" }}>Import multiple records via CSV. Ensure your file matches the template exactly.</p>
                        
                        <div style={{ background: "#0f172a", padding: "16px", borderRadius: "8px", marginBottom: "24px", textAlign: "center", border: "1px dashed #334155" }}>
                            <Btn variant="secondary" size="sm" onClick={() => downloadTemplate(bulkModal)}>Download Template</Btn>
                        </div>

                        <input type="file" ref={fileInputRef} onChange={e => handleFileUpload(e, bulkModal)} style={{ display: "none" }} accept=".csv" />
                        
                        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                            <Btn variant="secondary" onClick={() => setBulkModal(null)}>Cancel</Btn>
                            <Btn onClick={() => fileInputRef.current?.click()}>Select & Import CSV</Btn>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}