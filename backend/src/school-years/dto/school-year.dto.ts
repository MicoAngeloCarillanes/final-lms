import { RowDataPacket } from 'mysql2/promise';

export const VALID_TERMS = ['Prelim', 'Midterm', 'Semi-Final', 'Finals'] as const;
export type TermLabel = typeof VALID_TERMS[number];

// ─── Request DTOs (must be classes for emitDecoratorMetadata) ────────────────

export class CreateSchoolYearDto {
    label: string;       // e.g. '2025-2026'
    startDate: string;   // ISO date string
    endDate: string;
}

export class UpsertTermPeriodsDto {
    terms: {
        term: TermLabel;
        startDate: string;
        endDate: string;
    }[];
}

// ─── DB row shapes ────────────────────────────────────────────────────────────

export interface SchoolYearRow extends RowDataPacket {
    syId: string;
    label: string;
    startDate: string;
    endDate: string;
    isActive: number;
    createdAt: string;
}

export interface TermPeriodRow extends RowDataPacket {
    periodId: string;
    syId: string;
    term: TermLabel;
    startDate: string;
    endDate: string;
}

// ─── Response DTOs ────────────────────────────────────────────────────────────

export interface SchoolYearDto {
    syId: string;
    label: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
    createdAt: string;
    terms?: TermPeriodDto[];
}

export interface TermPeriodDto {
    periodId: string;
    term: TermLabel;
    startDate: string;
    endDate: string;
}
