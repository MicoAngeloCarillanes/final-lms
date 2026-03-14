import { IntersectionType, OmitType, PartialType } from '@nestjs/swagger';
import { PaginationRequestDto } from 'src/core/pagination/dto/pagination-request.dto';
import { ProgramRequestDto } from './program-request.dto';

export class ProgramSearchRequestDto extends IntersectionType(
    PartialType(OmitType(ProgramRequestDto, ['programId', 'description'] as const)),
    PaginationRequestDto
) {}
