import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ProgramRepository } from './repository/program.repository';
import { ProgramCreateRequestDto } from './dto/program-create-request.dto';
import { ProgramUpdateRequestDto } from './dto/program-update-request.dto';
import { ProgramSearchRequestDto } from './dto/program-search-request.dto';
import { PageableProgramDto, ProgramDto, ProgramOptionDto } from './dto/program.dto';

@Injectable()
export class ProgramService {
    constructor(private readonly programRepository: ProgramRepository) {}

    async create(dto: ProgramCreateRequestDto): Promise<string> {
        await this.assertUnique('code', dto.code);
        await this.assertUnique('name', dto.name);
        if (await this.programRepository.create(dto)) return 'Program created successfully.';
        throw new Error('Failed to create program.');
    }

    async getList(dto: ProgramSearchRequestDto): Promise<PageableProgramDto> {
        return this.programRepository.findList(dto);
    }

    async getById(programId: number): Promise<ProgramDto> {
        const row = await this.programRepository.findById(programId);
        if (!row) throw new NotFoundException('Program not found.');
        return row;
    }

    async getActiveOptions(): Promise<ProgramOptionDto[]> {
        return this.programRepository.findActiveOptions();
    }

    async updateById(dto: ProgramUpdateRequestDto): Promise<string> {
        await this.getById(dto.programId!);
        await this.assertUnique('code', dto.code, dto.programId);
        await this.assertUnique('name', dto.name, dto.programId);
        if (await this.programRepository.updateById(dto)) return 'Program updated successfully.';
        throw new Error('Failed to update program.');
    }

    async setActive(programId: number, isActive: 0 | 1): Promise<string> {
        if (await this.programRepository.updateIsActiveById(programId, isActive))
            return isActive === 1 ? 'Program activated.' : 'Program deactivated.';
        throw new NotFoundException('Program not found.');
    }

    async deleteById(programId: number): Promise<string> {
        if (await this.programRepository.softDeleteById(programId)) return 'Program deleted successfully.';
        throw new NotFoundException('Program not found.');
    }

    private async assertUnique(field: 'code' | 'name', value: string, excludeId?: number): Promise<void> {
        if (await this.programRepository.existsByField(field, value, excludeId))
            throw new ConflictException(`Program ${field} already exists.`);
    }
}
