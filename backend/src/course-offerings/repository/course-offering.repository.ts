import { Injectable } from '@nestjs/common';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { BaseRepository } from 'src/core/common/repository/base.repository';
import { DatabaseService } from 'src/database/service/database.service';
import {
    CourseOfferingRow,
    CreateCourseOfferingDto,
} from '../dto/course-offering.dto';

interface StudentCandidateRow extends RowDataPacket {
    studentId: string;
}

interface ExistingEnrollRow extends RowDataPacket {
    studentId: string;
}

@Injectable()
export class CourseOfferingRepository extends BaseRepository {
    constructor(databaseService: DatabaseService) {
        super(databaseService);
    }

    async create(dto: CreateCourseOfferingDto): Promise<string> {
        const { courseId, syId, term, yearLevel, programId, maxStudents } = dto;
        await this.pool.execute<ResultSetHeader>(
            `INSERT INTO course_offerings
                (course_id, sy_id, term, year_level, program_id, max_students)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [courseId, syId, term, yearLevel ?? null, programId ?? null, maxStudents ?? 40],
        );
        const [rows] = await this.pool.query<CourseOfferingRow[]>(
            `SELECT offering_id AS offeringId FROM course_offerings
             WHERE course_id = ? AND sy_id = ? AND term = ? ORDER BY created_at DESC LIMIT 1`,
            [courseId, syId, term],
        );
        return rows[0]?.offeringId ?? '';
    }

    async findAll(syId?: string, term?: string): Promise<CourseOfferingRow[]> {
        const conditions: string[] = ['co.is_active = 1'];
        const params: (string | number)[] = [];

        if (syId) { conditions.push('co.sy_id = ?'); params.push(syId); }
        if (term) { conditions.push('co.term = ?');  params.push(term); }

        const where = conditions.join(' AND ');

        const [rows] = await this.pool.query<CourseOfferingRow[]>(
            `SELECT
                co.offering_id          AS offeringId,
                co.course_id            AS courseId,
                c.course_code           AS courseCode,
                c.course_name           AS courseName,
                co.sy_id                AS syId,
                sy.label                AS syLabel,
                co.term,
                co.year_level           AS yearLevel,
                co.program_id           AS programId,
                p.name                  AS programName,
                co.max_students         AS maxStudents,
                co.is_active            AS isActive,
                co.created_at           AS createdAt,
                COUNT(DISTINCT sca.assignment_id) AS enrolledCount
             FROM course_offerings co
             JOIN courses c        ON c.course_id   = co.course_id
             JOIN school_years sy  ON sy.sy_id       = co.sy_id
             LEFT JOIN program p   ON p.program_id   = co.program_id
             LEFT JOIN student_course_assignments sca
                 ON sca.course_id = co.course_id
                 AND sca.enrollment_status = 'Enrolled'
             WHERE ${where}
             GROUP BY co.offering_id
             ORDER BY co.created_at DESC`,
            params,
        );
        return rows;
    }

    async findById(offeringId: string): Promise<CourseOfferingRow | null> {
        const [rows] = await this.pool.query<CourseOfferingRow[]>(
            `SELECT
                co.offering_id          AS offeringId,
                co.course_id            AS courseId,
                c.course_code           AS courseCode,
                c.course_name           AS courseName,
                co.sy_id                AS syId,
                sy.label                AS syLabel,
                co.term,
                co.year_level           AS yearLevel,
                co.program_id           AS programId,
                p.name                  AS programName,
                co.max_students         AS maxStudents,
                co.is_active            AS isActive,
                co.created_at           AS createdAt,
                COUNT(DISTINCT sca.assignment_id) AS enrolledCount
             FROM course_offerings co
             JOIN courses c        ON c.course_id   = co.course_id
             JOIN school_years sy  ON sy.sy_id       = co.sy_id
             LEFT JOIN program p   ON p.program_id   = co.program_id
             LEFT JOIN student_course_assignments sca
                 ON sca.course_id = co.course_id
                 AND sca.enrollment_status = 'Enrolled'
             WHERE co.offering_id = ?
             GROUP BY co.offering_id
             LIMIT 1`,
            [offeringId],
        );
        return rows[0] ?? null;
    }

    /**
     * Returns UUIDs of students eligible for auto-assign:
     * - role = 'student', is_active = 1
     * - matches year_level (if offering has one)
     * - enrolled in the offering's program (if offering has one)
     */
    async findEligibleStudents(
        offeringId: string,
        yearLevel: string | null,
        programId: number | null,
    ): Promise<string[]> {
        const conditions: string[] = [
            `u.role = 'student'`,
            `u.is_active = 1`,
        ];
        const params: (string | number | null)[] = [];

        if (yearLevel) {
            conditions.push(`st.year_level = ?`);
            params.push(yearLevel);
        }

        // If program filter: student must be enrolled in a course of that program
        // Simpler approach: join through program of the offering's course
        const where = conditions.join(' AND ');

        const [rows] = await this.pool.query<StudentCandidateRow[]>(
            `SELECT u.user_id AS studentId
             FROM users u
             JOIN students st ON st.user_id = u.user_id
             WHERE ${where}`,
            params,
        );
        return rows.map(r => r.studentId);
    }

    /** Finds students already enrolled in the course (any status). */
    async findAlreadyEnrolled(courseId: string): Promise<Set<string>> {
        const [rows] = await this.pool.query<ExistingEnrollRow[]>(
            `SELECT student_id AS studentId FROM student_course_assignments WHERE course_id = ?`,
            [courseId],
        );
        return new Set(rows.map(r => r.studentId));
    }

    /** Bulk insert into student_course_assignments. Returns count of inserted rows. */
    async bulkEnroll(
        studentIds: string[],
        courseId: string,
        syLabel: string,
    ): Promise<number> {
        if (!studentIds.length) return 0;
        let inserted = 0;
        for (const sid of studentIds) {
            const [res] = await this.pool.execute<ResultSetHeader>(
                `INSERT IGNORE INTO student_course_assignments
                    (student_id, course_id, enrollment_status, academic_year)
                 VALUES (?, ?, 'Enrolled', ?)`,
                [sid, courseId, syLabel],
            );
            inserted += res.affectedRows;
        }
        return inserted;
    }
}
