import { RowDataPacket } from 'mysql2';
import { PaginationDTO } from 'src/core/pagination/dto/pagination.dto';
import { DepartmentDto } from './department.dto';

/**
 * Allowed duplicate-check fields for department.
 */
export type DepartmentDuplicateField = 'code' | 'name' | 'email' | 'phone';

/**
 * Department List DTO
 */
export type PageableDepartmentDto = PaginationDTO<DepartmentDto>;

/**
 * Full department row shape returned by SQL queries.
 */
export type DepartmentRow = DepartmentDto & RowDataPacket;

/**
 * Row shape used for getting department ID.
 */
export interface DepartmentIdRow extends RowDataPacket {
    // Department primary key.
    departmentId: number;
}

/**
 * Row shape used for count queries.
 */
export interface DepartmentCountRow extends RowDataPacket {
    // Total row count.
    total: number;
}

/**
 * Row shape for getting department option.
 */
export interface DepartmentOptionRow extends DepartmentIdRow {
    // Department name.
    name: string;
}
