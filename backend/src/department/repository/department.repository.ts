import { Injectable } from '@nestjs/common';
import { ResultSetHeader } from 'mysql2/promise';
// prettier-ignore
import { NumberNullUndefined, TinyIntFlag } from 'src/core/common/dto/common.dto';
import { BaseRepository } from 'src/core/common/repository/base.repository';
// prettier-ignore
import { getFirstRowOrNull, sanitizeNumberValue, stringValueOrNull } from 'src/core/common/util/clean.util';
import { toPaginationDto } from 'src/core/pagination/mapper/pagination.mapper';
// prettier-ignore
import { buildOrderByClause } from 'src/core/pagination/util/pagination.util';
import { DatabaseService } from 'src/database/service/database.service';
import { DepartmentCreateRequestDto } from '../dto/department-create-request.dto';
// prettier-ignore
import { DepartmentCountRow, DepartmentDuplicateField, DepartmentIdRow, PageableDepartmentDto, DepartmentRow, DepartmentOptionRow } from '../dto/department-repository.dto';
import { DepartmentSearchRequestDto } from '../dto/department-search-request.dto';
import { DepartmentUpdateRequestDto } from '../dto/department-update-request.dto';
import { createDepartmentLikeParams } from '../util/department.util';

/**
 * Repository for department data access.
 * Handles all SQL queries related to the department table.
 */
@Injectable()
export class DepartmentRepository extends BaseRepository {
    constructor(databaseService: DatabaseService) {
        super(databaseService);
    }

    // Department table name.
    private readonly tableName: string = 'department';

    // prettier-ignore
    // Whitelisted duplicate-check columns.
    private readonly duplicateFieldColumns: Record<DepartmentDuplicateField, string> = {
        code: 'code',
        name: 'name',
        email: 'email',
        phone: 'phone'
    };

    // prettier-ignore
    /**
     * Inserts a new department record.
     *
     * @param requestDto the create department request payload.
     * @return the newly created department ID.
     */
    async create(requestDto: DepartmentCreateRequestDto): Promise<boolean> {
        const { code, name, room, email, phone, description} = requestDto;
        const [result] = await this.pool.execute<ResultSetHeader>(
            `INSERT INTO
                department (
                    code,
                    name,
                    room,
                    email,
                    phone,
                    description,
                    created_by
                )
            VALUES
                (?, ?, ?, ?, ?, ?, ?)`,
            [
                code,
                name,
                stringValueOrNull(room),
                stringValueOrNull(email),
                stringValueOrNull(phone),
                stringValueOrNull(description),
                null
            ]
        );

        return result.affectedRows === 1;
    }

    // prettier-ignore
    /**
     * Returns paginated department rows and total count based on search filters.
     *
     * @param searchRequestDTO department search and pagination request DTO.
     * @returns list rows and total count.
     */
    async findList(searchRequestDTO: DepartmentSearchRequestDto): Promise<PageableDepartmentDto> {
        const { code, name, room, page, size, isActive } = searchRequestDTO;
        const offset = (page - 1) * size;
        const sortableColumns = {
            id: 'id',
            code: 'code',
            name: 'name',
            room: 'room',
            email: 'email',
            phone: 'phone',
            isActive: 'is_active',
            createdDate: 'created_date',
            updatedDate: 'updated_date'
        };
        const orderByClause = buildOrderByClause(
            searchRequestDTO,
            sortableColumns,
            'ORDER BY created_date ASC'
        );
        let isActiveWhereClause = '';
        const params: Array<string | number> = createDepartmentLikeParams([name, code, room]);

        if (isActive != null) {
            isActiveWhereClause = 'AND is_active = ?';

            params.push(isActive);
        }

        params.push(size, offset);

        const total = await this.findCountByCodeAndNameAndRoom(code, name, room, isActive);
        const [rows] = await this.pool.query<DepartmentRow[]>(
            `SELECT
                department_id AS departmentId,
                code,
                name,
                room,
                email,
                phone,
                description,
                is_deleted AS isDeleted,
                is_active AS isActive,
                created_by AS createdBy,
                created_date AS createdDate,
                updated_by AS updatedBy,
                updated_date AS updatedDate
            FROM
                department
            WHERE
                is_deleted = 0
                AND name LIKE ?
                AND code LIKE ?
                AND COALESCE(room, '') LIKE ?
                ${isActiveWhereClause}
            ${orderByClause}
            LIMIT ?
            OFFSET ?`,
            params
        );

        return toPaginationDto<DepartmentRow>(
            rows,
            page,
            size,
            total,
            rows.length,
            Boolean(searchRequestDTO.sortParameters?.length)
        );
    }

    // prettier-ignore
    /**
     * Retrieves department by its ID and whether it's deleted or not.
     *
     * @param departmentId the department ID.
     * @param isDeleted the delete flag.
     * @return the full department row, or null if not found.
     */
    async findById(
        departmentId: NumberNullUndefined,
        isDeleted: TinyIntFlag = 1
    ): Promise<DepartmentRow | null> {
        const [rows] = await this.pool.query<DepartmentRow[]>(
            `SELECT
                department_id AS departmentId,
                code,
                name,
                room,
                email,
                phone,
                description,
                is_deleted AS isDeleted,
                is_active AS isActive,
                created_by AS createdBy,
                created_date AS createdDate,
                updated_by AS updatedBy,
                updated_date AS updatedDate
            FROM
                department
            WHERE
                department_id = ?
                AND is_deleted = ?
            LIMIT 1`,
            [departmentId, isDeleted]
        );

        return getFirstRowOrNull(rows);
    }

    /**
     * Returns active, non-deleted departments for select/dropdown options.
     * Only the department ID and name are returned.
     *
     * @returns active department option rows.
     */
    async findActiveDepartmentOptions(): Promise<DepartmentOptionRow[]> {
        const [rows] = await this.pool.query<DepartmentOptionRow[]>(
            `SELECT
                department_id AS departmentId,
                name
            FROM
                department
            WHERE
                is_deleted = 0
                AND is_active = 1
            ORDER BY
                created_date ASC`
        );

        return rows;
    }

    /**
     * Updates an existing active department row by primary key.
     * Soft-deleted rows are excluded from update.
     *
     * @param requestDto the department update payload.
     * @returns the number of affected rows.
     */
    async updateById(requestDto: DepartmentUpdateRequestDto): Promise<boolean> {
        const { departmentId, code, name, description, email, phone, room } =
            requestDto;
        const [result] = await this.pool.query<ResultSetHeader>(
            `UPDATE
                department
            SET
                code = ?,
                name = ?,
                room = ?,
                email = ?,
                phone = ?,
                description = ?,
                updated_date = NOW()
            WHERE
                is_deleted = 0
                AND department_id = ?
            LIMIT 1`,
            [
                code,
                name,
                stringValueOrNull(room),
                stringValueOrNull(email),
                stringValueOrNull(phone),
                stringValueOrNull(description),
                departmentId
            ]
        );

        return Boolean(result.affectedRows);
    }

    /**
     * Updates the active flag of a non-deleted department.
     *
     * @param departmentId the department ID to update.
     * @param isActive the active flag value (1 = active, 0 = inactive).
     * @returns true if the department was updated; otherwise, false.
     */
    async updateIsActiveById(
        departmentId: number,
        isActive: TinyIntFlag
    ): Promise<boolean> {
        const [result] = await this.pool.query<ResultSetHeader>(
            `UPDATE
                department
            SET
                is_active = ?
            WHERE
                department_id = ?
                AND is_deleted = 0`,
            [isActive, departmentId]
        );

        return Boolean(result.affectedRows);
    }

    // prettier-ignore
    /**
     * Soft deletes a department by setting is_deleted = 1 and is_active = 0.
     *
     * @param departmentId the department ID to soft delete.
     * @returns true if the department was updated; otherwise, false.
     */
    async softDeleteById(departmentId: number): Promise<boolean> {
        const [result] = await this.pool.query<ResultSetHeader>(
            `UPDATE
                department
            SET
                is_deleted = 1,
                is_active = 0
            WHERE
                department_id = ?
                AND is_deleted = 0`,
            [departmentId]
        );

        return Boolean(result.affectedRows);
    }

    // prettier-ignore
    /**
     * Returns total count of departments matching the name/code/room filters.
     *
     * @param code the department code.
     * @param name the department name.
     * @param room the department room.
     * @returns total matching rows.
     */
    async findCountByCodeAndNameAndRoom(
        code?: string,
        name?: string,
        room?: string,
        isActive?: TinyIntFlag
    ): Promise<number> {
        const params: Array<string | number> = createDepartmentLikeParams([name, code, room]);
        let isActiveWhereClause = '';

        if (isActive != null) {
            isActiveWhereClause = 'AND is_active = ?';

            params.push(isActive);
        }

        const [rows] = await this.pool.query<DepartmentCountRow[]>(
            `SELECT
                COUNT(*) AS total
            FROM
                department
            WHERE
                is_deleted = 0
                AND code LIKE ?
                AND name LIKE ?
                AND COALESCE(room, '') LIKE ?
                ${isActiveWhereClause}`,
            params
        );
        const count = sanitizeNumberValue(rows[0]?.total);

        return count
            ? count
            : 0;
    }

    // prettier-ignore
    /**
     * Checks whether a non-deleted department row exists with the same value
     * for a whitelisted duplicate field.
     *
     * @param duplicateColumn the allowed department duplicate field to check.
     * @param value the value to check for duplicates.
     * @param departmentId the department ID to be excluded.
     * @returns true if a duplicate exists; otherwise, false.
     */
    async existByFieldAndDepartmentIdNot(
        duplicateColumn: DepartmentDuplicateField,
        value: string,
        departmentId?: number
    ) {
        return this.existsByFieldAndIdNot<DepartmentIdRow, DepartmentDuplicateField>(
            duplicateColumn,
            value,
            this.tableName,
            this.duplicateFieldColumns,
            departmentId
        );
    }
}
