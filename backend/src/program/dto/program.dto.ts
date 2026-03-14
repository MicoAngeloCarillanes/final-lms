import { RowDataPacket } from 'mysql2';
import { PaginationDTO } from 'src/core/pagination/dto/pagination.dto';

export class ProgramDto {
    programId!: number;
    code!: string;
    name!: string;
    departmentId!: number | null;
    departmentName!: string | null;
    description!: string | null;
    isActive!: number;
    isDeleted!: number;
    createdDate!: Date;
    updatedDate!: Date | null;
}

export class ProgramOptionDto {
    programId!: number;
    name!: string;
    code!: string;
}

export type PageableProgramDto = PaginationDTO<ProgramDto>;
export type ProgramRow         = ProgramDto       & RowDataPacket;
export type ProgramOptionRow   = ProgramOptionDto & RowDataPacket;

export interface ProgramIdRow extends RowDataPacket { programId: number; }
export interface ProgramCountRow extends RowDataPacket { total: number; }
