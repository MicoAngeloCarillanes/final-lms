import { Injectable } from '@nestjs/common';
import { ResultSetHeader } from 'mysql2/promise';
import { BaseRepository } from 'src/core/common/repository/base.repository';
import { getFirstRowOrNull, sanitizeNumberValue, stringValueOrNull } from 'src/core/common/util/clean.util';
import { toPaginationDto } from 'src/core/pagination/mapper/pagination.mapper';
import { buildOrderByClause } from 'src/core/pagination/util/pagination.util';
import { DatabaseService } from 'src/database/service/database.service';
import { ProgramCreateRequestDto } from '../dto/program-create-request.dto';
import { ProgramUpdateRequestDto } from '../dto/program-update-request.dto';
import { ProgramSearchRequestDto } from '../dto/program-search-request.dto';
import {
    PageableProgramDto,
    ProgramCountRow,
    ProgramIdRow,
    ProgramOptionRow,
    ProgramRow,
} from '../dto/program.dto';

@Injectable()
export class ProgramRepository extends BaseRepository {
    constructor(databaseService: DatabaseService) {
        super(databaseService);
    }

    private readonly tableName = 'program';

    private readonly duplicateFieldColumns: Record<'code' | 'name', string> = {
        code: 'code',
        name: 'name',
    };

    async create(dto: ProgramCreateRequestDto): Promise<boolean> {
        const { code, name, departmentId, description } = dto;
        const [result] = await this.pool.execute<ResultSetHeader>(
            `INSERT INTO program (code, name, department_id, description) VALUES (?, ?, ?, ?)`,
            [code, name, departmentId ?? null, stringValueOrNull(description)]
        );
        return result.affectedRows === 1;
    }

    async findList(dto: ProgramSearchRequestDto): Promise<PageableProgramDto> {
        const { code, name, departmentId, page, size } = dto;
        const offset = (page - 1) * size;
        const sortableColumns: Record<string, string> = {
            programId: 'p.program_id', code: 'p.code',
            name: 'p.name', createdDate: 'p.created_date',
        };
        const orderByClause = buildOrderByClause(dto, sortableColumns, 'ORDER BY p.created_date ASC');
        const conditions: string[] = ['p.is_deleted = 0'];
        const params: (string | number | null)[] = [];
        if (name)         { conditions.push('p.name LIKE ?');       params.push(`%${name}%`); }
        if (code)         { conditions.push('p.code LIKE ?');       params.push(`%${code}%`); }
        if (departmentId) { conditions.push('p.department_id = ?'); params.push(departmentId); }
        const where = conditions.join(' AND ');

        const [cRows] = await this.pool.query<ProgramCountRow[]>(
            `SELECT COUNT(*) AS total FROM program p WHERE ${where}`, params
        );
        const total = sanitizeNumberValue(cRows[0]?.total) ?? 0;

        const [rows] = await this.pool.query<ProgramRow[]>(
            `SELECT p.program_id AS programId, p.code, p.name,
                    p.department_id AS departmentId, d.name AS departmentName,
                    p.description, p.is_active AS isActive, p.is_deleted AS isDeleted,
                    p.created_date AS createdDate, p.updated_date AS updatedDate
             FROM program p
             LEFT JOIN department d ON d.department_id = p.department_id AND d.is_deleted = 0
             WHERE ${where} ${orderByClause} LIMIT ? OFFSET ?`,
            [...params, size, offset]
        );
        return toPaginationDto<ProgramRow>(rows, page, size, total, rows.length, Boolean(dto.sortParameters?.length));
    }

    async findById(programId: number): Promise<ProgramRow | null> {
        const [rows] = await this.pool.query<ProgramRow[]>(
            `SELECT p.program_id AS programId, p.code, p.name,
                    p.department_id AS departmentId, d.name AS departmentName,
                    p.description, p.is_active AS isActive, p.is_deleted AS isDeleted,
                    p.created_date AS createdDate, p.updated_date AS updatedDate
             FROM program p
             LEFT JOIN department d ON d.department_id = p.department_id AND d.is_deleted = 0
             WHERE p.program_id = ? AND p.is_deleted = 0 LIMIT 1`,
            [programId]
        );
        return getFirstRowOrNull(rows);
    }

    async findActiveOptions(): Promise<ProgramOptionRow[]> {
        const [rows] = await this.pool.query<ProgramOptionRow[]>(
            `SELECT program_id AS programId, name, code FROM program
             WHERE is_deleted = 0 AND is_active = 1 ORDER BY name ASC`
        );
        return rows;
    }

    async updateById(dto: ProgramUpdateRequestDto): Promise<boolean> {
        const { programId, code, name, departmentId, description } = dto;
        const [result] = await this.pool.query<ResultSetHeader>(
            `UPDATE program SET code=?, name=?, department_id=?, description=?, updated_date=NOW()
             WHERE program_id=? AND is_deleted=0 LIMIT 1`,
            [code, name, departmentId ?? null, stringValueOrNull(description), programId]
        );
        return Boolean(result.affectedRows);
    }

    async updateIsActiveById(programId: number, isActive: 0 | 1): Promise<boolean> {
        const [result] = await this.pool.query<ResultSetHeader>(
            `UPDATE program SET is_active=? WHERE program_id=? AND is_deleted=0`,
            [isActive, programId]
        );
        return Boolean(result.affectedRows);
    }

    async softDeleteById(programId: number): Promise<boolean> {
        const [result] = await this.pool.query<ResultSetHeader>(
            `UPDATE program SET is_deleted=1, is_active=0 WHERE program_id=? AND is_deleted=0`,
            [programId]
        );
        return Boolean(result.affectedRows);
    }

    async existsByField(field: 'code' | 'name', value: string, excludeId?: number): Promise<boolean> {
        return this.existsByFieldAndIdNot<ProgramIdRow, 'code' | 'name'>(
            field, value, this.tableName, this.duplicateFieldColumns, excludeId
        );
    }
}
