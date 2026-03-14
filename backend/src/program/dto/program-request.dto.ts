import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ProgramRequestDto {
    @ApiPropertyOptional({ description: 'Program ID (used in update).' })
    @IsOptional()
    @IsInt()
    @Min(1)
    programId?: number;

    @ApiProperty({ description: 'Program code', example: 'BSCS', maxLength: 50 })
    @IsString()
    @MaxLength(50)
    code!: string;

    @ApiProperty({ description: 'Program name', example: 'Bachelor of Science in Computer Science', maxLength: 200 })
    @IsString()
    @MaxLength(200)
    name!: string;

    @ApiPropertyOptional({ description: 'Department ID this program belongs to', example: 1 })
    @IsOptional()
    @IsInt()
    @Min(1)
    departmentId?: number;

    @ApiPropertyOptional({ description: 'Program description', maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;
}
