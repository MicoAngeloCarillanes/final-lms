import { Injectable } from '@nestjs/common';
import { ResultSetHeader } from 'mysql2/promise';
import { BaseRepository } from 'src/core/common/repository/base.repository';
import { DatabaseService } from 'src/database/service/database.service';
import {
    AttendanceSummaryRow,
    BulkRecordDto,
    CreateSessionDto,
    RecordRow,
    SessionRow,
} from '../dto/attendance.dto';

@Injectable()
export class AttendanceRepository extends BaseRepository {
    constructor(databaseService: DatabaseService) {
        super(databaseService);
    }

    // ─── Sessions ─────────────────────────────────────────────────────────────

    async createSession(dto: CreateSessionDto): Promise<string> {
        const { courseId, sessionDate, label, term, deductAbsent, deductLate, createdBy } = dto;
        await this.pool.execute<ResultSetHeader>(
            `INSERT INTO attendance_sessions
                (course_id, session_date, label, term, deduct_absent, deduct_late, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [courseId, sessionDate, label ?? null, term, deductAbsent ?? 5, deductLate ?? 2.5, createdBy],
        );
        const [rows] = await this.pool.query<SessionRow[]>(
            `SELECT session_id AS sessionId FROM attendance_sessions
             WHERE course_id = ? AND session_date = ? AND term = ?
             ORDER BY created_at DESC LIMIT 1`,
            [courseId, sessionDate, term],
        );
        return rows[0]?.sessionId ?? '';
    }

    async findSessionsByCourse(courseId: string, term?: string): Promise<SessionRow[]> {
        const conditions = ['s.course_id = ?'];
        const params: (string | number)[] = [courseId];
        if (term) { conditions.push('s.term = ?'); params.push(term); }
        const where = conditions.join(' AND ');

        const [rows] = await this.pool.query<SessionRow[]>(
            `SELECT
                s.session_id    AS sessionId,
                s.course_id     AS courseId,
                s.session_date  AS sessionDate,
                s.label,
                s.term,
                s.deduct_absent AS deductAbsent,
                s.deduct_late   AS deductLate,
                s.created_by    AS createdBy,
                s.created_at    AS createdAt,
                SUM(r.status = 'Present') AS presentCount,
                SUM(r.status = 'Absent')  AS absentCount,
                SUM(r.status = 'Late')    AS lateCount,
                SUM(r.status = 'Excused') AS excusedCount
             FROM attendance_sessions s
             LEFT JOIN attendance_records r ON r.session_id = s.session_id
             WHERE ${where}
             GROUP BY s.session_id
             ORDER BY s.session_date DESC`,
            params,
        );
        return rows;
    }

    async findSessionById(sessionId: string): Promise<SessionRow | null> {
        const [rows] = await this.pool.query<SessionRow[]>(
            `SELECT
                s.session_id    AS sessionId,
                s.course_id     AS courseId,
                s.session_date  AS sessionDate,
                s.label,
                s.term,
                s.deduct_absent AS deductAbsent,
                s.deduct_late   AS deductLate,
                s.created_by    AS createdBy,
                s.created_at    AS createdAt,
                SUM(r.status = 'Present') AS presentCount,
                SUM(r.status = 'Absent')  AS absentCount,
                SUM(r.status = 'Late')    AS lateCount,
                SUM(r.status = 'Excused') AS excusedCount
             FROM attendance_sessions s
             LEFT JOIN attendance_records r ON r.session_id = s.session_id
             WHERE s.session_id = ?
             GROUP BY s.session_id LIMIT 1`,
            [sessionId],
        );
        return rows[0] ?? null;
    }

    // ─── Records ──────────────────────────────────────────────────────────────

    async bulkUpsertRecords(sessionId: string, dto: BulkRecordDto): Promise<number> {
        let upserted = 0;
        for (const rec of dto.records) {
            const [res] = await this.pool.execute<ResultSetHeader>(
                `INSERT INTO attendance_records (session_id, student_id, status)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE status = VALUES(status)`,
                [sessionId, rec.studentId, rec.status],
            );
            upserted += res.affectedRows;
        }
        return upserted;
    }

    async findRecordsBySession(sessionId: string): Promise<RecordRow[]> {
        const [rows] = await this.pool.query<RecordRow[]>(
            `SELECT
                r.record_id  AS recordId,
                r.session_id AS sessionId,
                r.student_id AS studentId,
                u.full_name  AS studentName,
                u.display_id AS displayId,
                r.status,
                r.created_at AS createdAt
             FROM attendance_records r
             JOIN users u ON u.user_id = r.student_id
             WHERE r.session_id = ?
             ORDER BY u.full_name`,
            [sessionId],
        );
        return rows;
    }

    // ─── Summary ──────────────────────────────────────────────────────────────

    async getAttendanceSummary(courseId: string, term: string): Promise<AttendanceSummaryRow[]> {
        const [rows] = await this.pool.query<AttendanceSummaryRow[]>(
            `SELECT
                u.user_id     AS studentId,
                u.full_name   AS studentName,
                u.display_id  AS displayId,
                COUNT(DISTINCT s.session_id)                   AS totalSessions,
                SUM(r.status = 'Present')                      AS presents,
                SUM(r.status = 'Absent')                       AS absents,
                SUM(r.status = 'Late')                         AS lates,
                SUM(r.status = 'Excused')                      AS excused,
                GREATEST(0, ROUND(
                    100 - (SUM(r.status = 'Absent')  * (SELECT deduct_absent FROM attendance_sessions WHERE session_id = s.session_id LIMIT 1))
                        - (SUM(r.status = 'Late')    * (SELECT deduct_late    FROM attendance_sessions WHERE session_id = s.session_id LIMIT 1)),
                    2
                )) AS attendancePct
             FROM student_course_assignments sca
             JOIN users u ON u.user_id = sca.student_id
             LEFT JOIN attendance_sessions s
                 ON s.course_id = sca.course_id AND s.term = ?
             LEFT JOIN attendance_records r
                 ON r.session_id = s.session_id AND r.student_id = u.user_id
             WHERE sca.course_id = ? AND sca.enrollment_status = 'Enrolled'
             GROUP BY u.user_id
             ORDER BY u.full_name`,
            [term, courseId],
        );
        return rows;
    }

    /** Get graded project submissions for a student in a course+term (for CS modal). */
    async getProjectSubmissions(courseId: string, studentId: string, term: string) {
        const [rows] = await this.pool.query(
            `SELECT
                ws.submission_id AS submissionId,
                m.title          AS materialTitle,
                m.material_type  AS materialType,
                ws.score,
                ws.submitted_at  AS submittedAt
             FROM work_submissions ws
             JOIN materials m ON m.material_id = ws.material_id
             WHERE m.course_id = ?
               AND ws.student_id = ?
               AND m.term = ?
               AND m.material_type IN ('Lab','Assignment')
               AND ws.status = 'Graded'
               AND ws.score IS NOT NULL
             ORDER BY ws.submitted_at DESC`,
            [courseId, studentId, term],
        );
        return rows;
    }
}
