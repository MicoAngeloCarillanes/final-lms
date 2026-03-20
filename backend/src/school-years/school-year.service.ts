import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SchoolYearRepository } from './repository/school-year.repository';
import {
    CreateSchoolYearDto,
    SchoolYearDto,
    TermPeriodDto,
    UpsertTermPeriodsDto,
} from './dto/school-year.dto';

@Injectable()
export class SchoolYearService {
    constructor(private readonly repo: SchoolYearRepository) {}

    async create(dto: CreateSchoolYearDto): Promise<SchoolYearDto> {
        if (await this.repo.existsByLabel(dto.label)) {
            throw new ConflictException(`School year "${dto.label}" already exists.`);
        }
        const syId = await this.repo.create(dto);
        const row = await this.repo.findById(syId);
        return this.toDto(row!);
    }

    async getAll(): Promise<SchoolYearDto[]> {
        const rows = await this.repo.findAll();
        return rows.map(r => this.toDto(r));
    }

    async setActive(syId: string): Promise<string> {
        const row = await this.repo.findById(syId);
        if (!row) throw new NotFoundException(`School year not found.`);
        await this.repo.setActive(syId);
        return `School year "${row.label}" set as active.`;
    }

    async upsertTermPeriods(syId: string, dto: UpsertTermPeriodsDto): Promise<string> {
        const row = await this.repo.findById(syId);
        if (!row) throw new NotFoundException(`School year not found.`);
        await this.repo.upsertTermPeriods(syId, dto);
        return 'Term periods saved successfully.';
    }

    async getTermsBySy(syId: string): Promise<TermPeriodDto[]> {
        const rows = await this.repo.findTermsBySyId(syId);
        return rows.map(r => ({
            periodId: r.periodId,
            term:      r.term,
            startDate: r.startDate,
            endDate:   r.endDate,
        }));
    }

    async getWithTerms(syId: string): Promise<SchoolYearDto> {
        const row = await this.repo.findById(syId);
        if (!row) throw new NotFoundException(`School year not found.`);
        const terms = await this.getTermsBySy(syId);
        return { ...this.toDto(row), terms };
    }

    /** Returns today's current term from the active SY config, or null if unset. */
    async getCurrentTerm(): Promise<{ term: string | null }> {
        const today = new Date().toISOString().slice(0, 10);
        const term = await this.repo.findCurrentTerm(today);
        return { term };
    }

    private toDto(row: NonNullable<Awaited<ReturnType<SchoolYearRepository['findById']>>>): SchoolYearDto {
        return {
            syId:      row!.syId,
            label:     row!.label,
            startDate: row!.startDate,
            endDate:   row!.endDate,
            isActive:  Boolean(row!.isActive),
            createdAt: row!.createdAt,
        };
    }
}
