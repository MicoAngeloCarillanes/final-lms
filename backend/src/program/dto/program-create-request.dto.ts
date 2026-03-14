import { OmitType } from '@nestjs/swagger';
import { ProgramRequestDto } from './program-request.dto';

export class ProgramCreateRequestDto extends OmitType(
    ProgramRequestDto,
    ['programId'] as const
) {}
