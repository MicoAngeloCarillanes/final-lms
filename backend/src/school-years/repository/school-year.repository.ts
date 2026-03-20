import { Injectable } from '@nestjs/common';
import { ResultSetHeader } from 'mysql2/promise';
import { BaseRepository } from 'src/core/common/repository/base.repository';
import { DatabaseService } from 'src/database/service/database.service';
import {
    CreateSchoolYearDto,
    SchoolYearRow,
    TermPeriodRow,
    TermPeriodDto,
    UpsertTermPeriodsDto,
} from '../dto/school-year.dto';

@Injectable()
export class SchoolYearRepository extends BaseRepository {
    constructor(databaseService: DatabaseService) {
        super(databaseService);
    }

    async create(dto: CreateSchoolYearDto): Promise<string> {
        const { label, startDate, endDate } = dto;
        const [result] = await this.pool.execute<ResultSetHeader>(
            `INSERT INTO school_years (label, start_date, end_date) VALUES (?, ?, ?)`,
            [label, startDate, endDate],
        );
        if (result.affectedRows !== 1) throw new Error('Failed to create school year.');
        // Return the generated UUID via last insert — fetch by label
        const [rows] = await this.pool.query<SchoolYearRow[]>(
            `SELECT sy_id AS syId FROM school_years WHERE label = ? LIMIT 1`,
            [label],
        );
        return rows[0]?.syId ?? '';
    }

    async findAll(): Promise<SchoolYearRow[]> {
        const [rows] = await this.pool.query<SchoolYearRow[]>(
            `SELECT sy_id AS syId, label, start_date AS startDate, end_date AS endDate,
                    is_active AS isActive, created_at AS createdAt
             FROM school_years ORDER BY created_at DESC`,
        );
        return rows;
    }

    async findById(syId: string): Promise<SchoolYearRow | null> {
        const [rows] = await this.pool.query<SchoolYearRow[]>(
            `SELECT sy_id AS syId, label, start_date AS startDate, end_date AS endDate,
                    is_active AS isActive, created_at AS createdAt
             FROM school_years WHERE sy_id = ? LIMIT 1`,
            [syId],
        );
        return rows[0] ?? null;
    }

    async findActive(): Promise<SchoolYearRow | null> {
        const [rows] = await this.pool.query<SchoolYearRow[]>(
            `SELECT sy_id AS syId, label, start_date AS startDate, end_date AS endDate,
                    is_active AS isActive, created_at AS createdAt
             FROM school_years WHERE is_active = 1 LIMIT 1`,
        );
        return rows[0] ?? null;
    }

    async setActive(syId: string): Promise<void> {
        await this.pool.execute(`UPDATE school_years SET is_active = 0`);
        await this.pool.execute(`UPDATE school_years SET is_active = 1 WHERE sy_id = ?`, [syId]);
    }

    async existsByLabel(label: string): Promise<boolean> {
        const [rows] = await this.pool.query<SchoolYearRow[]>(
            `SELECT sy_id AS syId FROM school_years WHERE label = ? LIMIT 1`,
            [label],
        );
        return rows.length > 0;
    }

    // ─── Term periods ─────────────────────────────────────────────────────────

    async upsertTermPeriods(syId: string, dto: UpsertTermPeriodsDto): Promise<void> {
        for (const t of dto.terms) {
            await this.pool.execute(
                `INSERT INTO term_periods (sy_id, term, start_date, end_date)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE start_date = VALUES(start_date), end_date = VALUES(end_date)`,
                [syId, t.term, t.startDate, t.endDate],
            );
        }
    }

    async findTermsBySyId(syId: string): Promise<TermPeriodRow[]> {
        const [rows] = await this.pool.query<TermPeriodRow[]>(
            `SELECT period_id AS periodId, sy_id AS syId, term,
                    start_date AS startDate, end_date AS endDate
             FROM term_periods WHERE sy_id = ? ORDER BY FIELD(term,'Prelim','Midterm','Semi-Final','Finals')`,
            [syId],
        );
        return rows;
    }

    async findCurrentTerm(today: string): Promise<string | null> {
        // today is 'YYYY-MM-DD'
        const [rows] = await this.pool.query<TermPeriodRow[]>(
            `SELECT tp.term
             FROM term_periods tp
             JOIN school_years sy ON sy.sy_id = tp.sy_id AND sy.is_active = 1
             WHERE ? BETWEEN tp.start_date AND tp.end_date
             LIMIT 1`,
            [today],
        );
        return rows[0]?.term ?? null;
    }
}
