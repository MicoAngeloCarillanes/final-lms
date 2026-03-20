import { RowDataPacket } from 'mysql2/promise';

export const ATTENDANCE_STATUSES = ['Present', 'Absent', 'Late', 'Excused'] as const;
export type AttendanceStatus = typeof ATTENDANCE_STATUSES[number];

// ─── Request DTOs (must be classes for emitDecoratorMetadata) ────────────────

export class CreateSessionDto {
    courseId: string;
    sessionDate: string;   // 'YYYY-MM-DD'
    label?: string;
    term: string;
    deductAbsent?: number;
    deductLate?: number;
    createdBy: string;     // teacher user_id (UUID)
}

export class BulkRecordDto {
    records: {
        studentId: string;
        status: AttendanceStatus;
    }[];
}

// ─── DB row shapes ────────────────────────────────────────────────────────────

export interface SessionRow extends RowDataPacket {
    sessionId: string;
    courseId: string;
    sessionDate: string;
    label: string | null;
    term: string;
    deductAbsent: number;
    deductLate: number;
    createdBy: string | null;
    createdAt: string;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    excusedCount: number;
}

export interface RecordRow extends RowDataPacket {
    recordId: string;
    sessionId: string;
    studentId: string;
    studentName: string;
    displayId: string;
    status: AttendanceStatus;
    createdAt: string;
}

export interface AttendanceSummaryRow extends RowDataPacket {
    studentId: string;
    studentName: string;
    displayId: string;
    totalSessions: number;
    presents: number;
    absents: number;
    lates: number;
    excused: number;
    attendancePct: number;
}

// ─── Response DTOs ────────────────────────────────────────────────────────────

export interface SessionDto {
    sessionId: string;
    courseId: string;
    sessionDate: string;
    label: string | null;
    term: string;
    deductAbsent: number;
    deductLate: number;
    createdBy: string | null;
    createdAt: string;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    excusedCount: number;
}

export interface RecordDto {
    recordId: string;
    sessionId: string;
    studentId: string;
    studentName: string;
    displayId: string;
    status: AttendanceStatus;
}

export interface AttendanceSummaryDto {
    studentId: string;
    studentName: string;
    displayId: string;
    totalSessions: number;
    presents: number;
    absents: number;
    lates: number;
    excused: number;
    attendancePct: number;
}
