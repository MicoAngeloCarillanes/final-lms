import { Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceRepository } from './repository/attendance.repository';
import {
    AttendanceSummaryDto,
    BulkRecordDto,
    CreateSessionDto,
    RecordDto,
    SessionDto,
    SessionRow,
    RecordRow,
    AttendanceSummaryRow,
} from './dto/attendance.dto';

@Injectable()
export class AttendanceService {
    constructor(private readonly repo: AttendanceRepository) {}

    async createSession(dto: CreateSessionDto): Promise<SessionDto> {
        const sessionId = await this.repo.createSession(dto);
        const row = await this.repo.findSessionById(sessionId);
        return this.toSessionDto(row!);
    }

    async getSessionsByCourse(courseId: string, term?: string): Promise<SessionDto[]> {
        const rows = await this.repo.findSessionsByCourse(courseId, term);
        return rows.map(r => this.toSessionDto(r));
    }

    async getSessionById(sessionId: string): Promise<SessionDto> {
        const row = await this.repo.findSessionById(sessionId);
        if (!row) throw new NotFoundException('Attendance session not found.');
        return this.toSessionDto(row);
    }

    async saveRecords(sessionId: string, dto: BulkRecordDto): Promise<{ saved: number }> {
        const row = await this.repo.findSessionById(sessionId);
        if (!row) throw new NotFoundException('Attendance session not found.');
        const saved = await this.repo.bulkUpsertRecords(sessionId, dto);
        return { saved };
    }

    async getRecords(sessionId: string): Promise<RecordDto[]> {
        const rows = await this.repo.findRecordsBySession(sessionId);
        return rows.map(r => this.toRecordDto(r));
    }

    async getSummary(courseId: string, term: string): Promise<AttendanceSummaryDto[]> {
        const rows = await this.repo.getAttendanceSummary(courseId, term);
        return rows.map(r => ({
            studentId:    r.studentId,
            studentName:  r.studentName,
            displayId:    r.displayId,
            totalSessions: Number(r.totalSessions),
            presents:     Number(r.presents),
            absents:      Number(r.absents),
            lates:        Number(r.lates),
            excused:      Number(r.excused),
            attendancePct: Number(r.attendancePct),
        }));
    }

    async getProjectSubmissions(courseId: string, studentId: string, term: string) {
        return this.repo.getProjectSubmissions(courseId, studentId, term);
    }

    private toSessionDto(row: SessionRow): SessionDto {
        return {
            sessionId:    row.sessionId,
            courseId:     row.courseId,
            sessionDate:  row.sessionDate,
            label:        row.label,
            term:         row.term,
            deductAbsent: Number(row.deductAbsent),
            deductLate:   Number(row.deductLate),
            createdBy:    row.createdBy,
            createdAt:    row.createdAt,
            presentCount: Number(row.presentCount ?? 0),
            absentCount:  Number(row.absentCount  ?? 0),
            lateCount:    Number(row.lateCount    ?? 0),
            excusedCount: Number(row.excusedCount ?? 0),
        };
    }

    private toRecordDto(row: RecordRow): RecordDto {
        return {
            recordId:    row.recordId,
            sessionId:   row.sessionId,
            studentId:   row.studentId,
            studentName: row.studentName,
            displayId:   row.displayId,
            status:      row.status,
        };
    }
}
