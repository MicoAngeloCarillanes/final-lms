import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import TopBar from '../../components/TopBar';
import { Badge, Btn, Card, FF, Input, Sel, Toast } from '../../components/ui';
import { programApi, userApi } from '../../lib/api';

const STUDENT_HEADERS = [
    'fullName',
    'email',
    'birthdate',
    'address',
    'civilStatus',
    'yearLevel',
    'semester',
    'programId',
    'username',
    'password'
];

const TEACHER_HEADERS = [
    'fullName',
    'email',
    'birthdate',
    'address',
    'civilStatus',
    'username',
    'password'
];

const STUDENT_SAMPLE_ROWS = [
    [
        'Juan Dela Cruz',
        'juan@example.com',
        '2004-03-12',
        'Quezon City',
        'Single',
        '1st Year',
        '1st Semester',
        '1',
        '',
        'Welcome@123'
    ],
    [
        'Maria Santos',
        'maria@example.com',
        '2003-10-01',
        'Manila',
        'Single',
        '2nd Year',
        '2nd Semester',
        '2',
        '',
        'Welcome@123'
    ]
];

const TEACHER_SAMPLE_ROWS = [
    [
        'Ana Reyes',
        'ana@example.com',
        '1990-01-10',
        'Makati',
        'Single',
        '',
        'Welcome@123'
    ],
    [
        'Pedro Cruz',
        'pedro@example.com',
        '1988-05-22',
        'Pasig',
        'Married',
        '',
        'Welcome@123'
    ]
];

function getTemplateData(role) {
    if (role === 'student') {
        return {
            headers: STUDENT_HEADERS,
            rows: STUDENT_SAMPLE_ROWS,
            fileName: 'student-bulk-template'
        };
    }

    return {
        headers: TEACHER_HEADERS,
        rows: TEACHER_SAMPLE_ROWS,
        fileName: 'teacher-bulk-template'
    };
}

function escapeCsvCell(value) {
    const text = String(value ?? '');

    if (text.includes('"') || text.includes(',') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
}

function downloadCsvTemplate(role) {
    const { headers, rows, fileName } = getTemplateData(role);

    const csvLines = [
        headers.map(escapeCsvCell).join(','),
        ...rows.map((row) => row.map(escapeCsvCell).join(','))
    ];

    const csvContent = csvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

function downloadExcelTemplate(role) {
    const { headers, rows, fileName } = getTemplateData(role);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

function normalizeCellValue(value) {
    if (value === null || value === undefined) {
        return '';
    }

    if (typeof value === 'number') {
        return String(value);
    }

    return String(value).trim();
}

function normalizeHeader(header) {
    return String(header ?? '')
        .trim()
        .replace(/\s+/g, '')
        .replace(/_/g, '')
        .toLowerCase();
}

function headerAliasMap() {
    return {
        fullname: 'fullName',
        full_name: 'fullName',
        name: 'fullName',
        email: 'email',
        birthdate: 'birthdate',
        birthday: 'birthdate',
        dateofbirth: 'birthdate',
        address: 'address',
        civilstatus: 'civilStatus',
        civil_status: 'civilStatus',
        yearlevel: 'yearLevel',
        year_level: 'yearLevel',
        semester: 'semester',
        programid: 'programId',
        program_id: 'programId',
        username: 'username',
        user_name: 'username',
        password: 'password'
    };
}

function mapHeaders(rawHeaders) {
    const aliases = headerAliasMap();

    return rawHeaders.map((header) => {
        const normalized = normalizeHeader(header);
        return aliases[normalized] || String(header).trim();
    });
}

function sheetToRows(worksheet) {
    const raw = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        raw: false
    });

    if (!raw.length) {
        return [];
    }

    const headers = mapHeaders(raw[0]);

    return raw
        .slice(1)
        .filter((row) => Array.isArray(row) && row.some((cell) => normalizeCellValue(cell) !== ''))
        .map((row) => {
            const obj = {};

            headers.forEach((header, index) => {
                obj[header] = normalizeCellValue(row[index]);
            });

            return obj;
        });
}

function parseCsvText(text) {
    const workbook = XLSX.read(text, {
        type: 'string'
    });

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    return sheetToRows(worksheet);
}

async function parseUploadedFile(file) {
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (!['csv', 'xlsx', 'xls'].includes(extension || '')) {
        throw new Error('Only CSV, XLSX, and XLS files are supported.');
    }

    const buffer = await file.arrayBuffer();

    const workbook = XLSX.read(buffer, {
        type: 'array'
    });

    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
        return [];
    }

    const worksheet = workbook.Sheets[firstSheetName];

    return sheetToRows(worksheet);
}

function downloadTemplate(role) {
    const headers = role === 'student' ? STUDENT_HEADERS : TEACHER_HEADERS;
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    XLSX.writeFile(workbook, `${role}-bulk-template.xlsx`);
}

export default function AdminBulkAccounts({ setUsers }) {
    const [role, setRole] = useState('student');
    const [defaultPassword, setDefaultPassword] = useState('Welcome@123');
    const [programOpts, setProgramOpts] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewRows, setPreviewRows] = useState([]);
    const [busy, setBusy] = useState(false);
    const [toast, setToast] = useState('');
    const [result, setResult] = useState({ created: [], failed: [] });

    useEffect(() => {
        async function loadPrograms() {
            try {
                const options = await programApi.getOptions();
                setProgramOpts(options ?? []);
            } catch (error) {
                console.error(error);
            }
        }

        loadPrograms();
    }, []);

    useEffect(() => {
        setSelectedFile(null);
        setPreviewRows([]);
        setResult({ created: [], failed: [] });
        setToast('');
    }, [role]);

    const preview = useMemo(() => previewRows.slice(0, 10), [previewRows]);

    async function handleFileChange(event) {
        const file = event.target.files?.[0] ?? null;

        setSelectedFile(file);
        setPreviewRows([]);
        setResult({ created: [], failed: [] });
        setToast('');

        if (!file) {
            return;
        }

        try {
            const parsedRows = await parseUploadedFile(file);
            setPreviewRows(parsedRows);

            if (!parsedRows.length) {
                setToast('The uploaded file has no data rows.');
            }
        } catch (error) {
            setToast(error.message || 'Failed to read uploaded file.');
        }
    }

    async function handleCreate() {
        if (!previewRows.length) {
            setToast('Please upload a valid CSV or Excel file first.');
            return;
        }

        setBusy(true);
        setToast('');

        try {
            const bulkResult = await userApi.bulkCreateAccounts({
                role,
                rows: previewRows,
                defaultPassword,
                programOptions: programOpts
            });

            setResult(bulkResult);

            if (typeof setUsers === 'function' && bulkResult.created.length) {
                setUsers((prev) => [...prev, ...bulkResult.created]);
            }

            setToast(
                `Created ${bulkResult.created.length} account(s). Failed: ${bulkResult.failed.length}.`
            );
        } catch (error) {
            setToast(error.message || 'Bulk creation failed.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <TopBar
                title="Bulk Account Creation"
                subtitle="Upload CSV or Excel files for student or teacher account generation."
                actions={
                    <>
                        <Btn
                            variant="secondary"
                            onClick={() => downloadCsvTemplate(role)}
                        >
                            Download CSV Template
                        </Btn>

                        <Btn
                            variant="secondary"
                            onClick={() => downloadExcelTemplate(role)}
                        >
                            Download Excel Template
                        </Btn>

                        <Btn onClick={handleCreate} disabled={busy || !previewRows.length}>
                            {busy ? 'Creating...' : 'Create Accounts'}
                        </Btn>
                    </>
                }
            />

            <div
                style={{
                    padding: 20,
                    display: 'grid',
                    gridTemplateColumns: '340px 1fr',
                    gap: 16,
                    overflow: 'auto'
                }}
            >
                <Card>
                    <div style={{ display: 'grid', gap: 12 }}>
                        <FF label="Role">
                            <Sel value={role} onChange={(e) => setRole(e.target.value)}>
                                <option value="student">Student</option>
                                <option value="teacher">Teacher</option>
                            </Sel>
                        </FF>

                        <FF label="Default Password">
                            <Input
                                value={defaultPassword}
                                onChange={(e) => setDefaultPassword(e.target.value)}
                                placeholder="Welcome@123"
                            />
                        </FF>

                        <FF label="Upload File">
                            <input
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                onChange={handleFileChange}
                                style={{ color: '#e2e8f0' }}
                            />
                        </FF>

                        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
                            Accepted file types:
                            <div style={{ marginTop: 6 }}>
                                <Badge color="info">CSV</Badge>{' '}
                                <Badge color="info">XLSX</Badge>{' '}
                                <Badge color="info">XLS</Badge>
                            </div>
                        </div>

                        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
                            Required columns:
                            <div style={{ marginTop: 6 }}>
                                <Badge color="info">fullName</Badge>{' '}
                                <Badge color="info">birthdate</Badge>
                                {role === 'student' && (
                                    <>
                                        {' '}
                                        <Badge color="purple">programId</Badge>
                                    </>
                                )}
                            </div>
                        </div>

                        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
                            Optional columns:
                            <div style={{ marginTop: 6 }}>
                                <Badge color="info">email</Badge>{' '}
                                <Badge color="info">address</Badge>{' '}
                                <Badge color="info">civilStatus</Badge>{' '}
                                <Badge color="info">username</Badge>{' '}
                                <Badge color="info">password</Badge>
                                {role === 'student' && (
                                    <>
                                        {' '}
                                        <Badge color="purple">yearLevel</Badge>{' '}
                                        <Badge color="purple">semester</Badge>
                                    </>
                                )}
                            </div>
                        </div>

                        {selectedFile && (
                            <div style={{ fontSize: 12, color: '#cbd5e1' }}>
                                Selected file: {selectedFile.name}
                            </div>
                        )}

                        {role === 'student' && (
                            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
                                Available program IDs:
                                <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                                    {programOpts.map((program) => (
                                        <div
                                            key={program.programId}
                                            style={{ fontSize: 12, color: '#cbd5e1' }}
                                        >
                                            {program.programId} — {program.code} / {program.name}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <Toast msg={toast} />
                    </div>
                </Card>

                <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'grid', gap: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
                            Preview ({previewRows.length})
                        </div>

                        <div
                            style={{
                                overflowX: 'auto',
                                border: '1px solid #334155',
                                borderRadius: 8
                            }}
                        >
                            <table
                                style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    fontSize: 12
                                }}
                            >
                                <thead>
                                    <tr style={{ background: '#0f172a', color: '#94a3b8' }}>
                                        <th style={{ padding: 10, textAlign: 'left' }}>#</th>
                                        <th style={{ padding: 10, textAlign: 'left' }}>Full Name</th>
                                        <th style={{ padding: 10, textAlign: 'left' }}>Username</th>
                                        <th style={{ padding: 10, textAlign: 'left' }}>Email</th>
                                        <th style={{ padding: 10, textAlign: 'left' }}>Birthdate</th>
                                        {role === 'student' && (
                                            <th style={{ padding: 10, textAlign: 'left' }}>Program</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.map((row, index) => (
                                        <tr
                                            key={index}
                                            style={{
                                                borderTop: '1px solid #334155',
                                                color: '#e2e8f0'
                                            }}
                                        >
                                            <td style={{ padding: 10 }}>{index + 1}</td>
                                            <td style={{ padding: 10 }}>{row.fullName}</td>
                                            <td style={{ padding: 10 }}>{row.username || 'auto-generated'}</td>
                                            <td style={{ padding: 10 }}>{row.email}</td>
                                            <td style={{ padding: 10 }}>{row.birthdate}</td>
                                            {role === 'student' && (
                                                <td style={{ padding: 10 }}>{row.programId}</td>
                                            )}
                                        </tr>
                                    ))}

                                    {!preview.length && (
                                        <tr>
                                            <td
                                                colSpan={role === 'student' ? 6 : 5}
                                                style={{ padding: 14, color: '#64748b' }}
                                            >
                                                Upload a CSV or Excel file to preview rows.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
                            You may download a ready-made template in either CSV or Excel format, fill it up,
                            then upload it here for bulk account creation.
                        </div>
                        {(result.created.length > 0 || result.failed.length > 0) && (
                            <div style={{ display: 'grid', gap: 12 }}>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <Badge color="success">Created: {result.created.length}</Badge>
                                    <Badge color="danger">Failed: {result.failed.length}</Badge>
                                </div>

                                {result.created.length > 0 && (
                                    <Card style={{ background: '#0f172a' }}>
                                        <div
                                            style={{
                                                fontSize: 13,
                                                fontWeight: 700,
                                                color: '#34d399',
                                                marginBottom: 8
                                            }}
                                        >
                                            Created Accounts
                                        </div>

                                        <div style={{ display: 'grid', gap: 6 }}>
                                            {result.created.map((row) => (
                                                <div
                                                    key={row._uuid}
                                                    style={{ fontSize: 12, color: '#e2e8f0' }}
                                                >
                                                    {row.id} — {row.fullName} — {row.username}
                                                    {row.generatedPassword
                                                        ? ` — password: ${row.generatedPassword}`
                                                        : ''}
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                )}

                                {result.failed.length > 0 && (
                                    <Card style={{ background: '#0f172a' }}>
                                        <div
                                            style={{
                                                fontSize: 13,
                                                fontWeight: 700,
                                                color: '#f87171',
                                                marginBottom: 8
                                            }}
                                        >
                                            Failed Rows
                                        </div>

                                        <div style={{ display: 'grid', gap: 6 }}>
                                            {result.failed.map((row, index) => (
                                                <div
                                                    key={`${row.rowNumber || index}-${index}`}
                                                    style={{ fontSize: 12, color: '#e2e8f0' }}
                                                >
                                                    Row {row.rowNumber || index + 1}:{' '}
                                                    {row.fullName || row.username || 'Unknown'} — {row.reason}
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                )}
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}