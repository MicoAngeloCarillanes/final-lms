import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
// prettier-ignore
import { IsArray, IsInt, IsOptional, Min, ValidateNested } from 'class-validator';
import { SortDto } from './sort.dto';

/**
 * DTO for pagination and multi-sort request parameters.
 */
export class PaginationRequestDto {
    @ApiProperty({
        example: 1,
        description: 'Page number (1-based).'
    })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page: number;

    @ApiProperty({
        example: 5,
        description: 'Page size.'
    })
    @Type(() => Number)
    @IsInt()
    @Min(5)
    size: number;

    @ApiPropertyOptional({
        type: [SortDto],
        description: 'Multi-sort parameters.',
        example: [
            { sortBy: 'name', sortDirection: 'asc' },
            { sortBy: 'code', sortDirection: 'DESC' }
        ]
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SortDto)
    sortParameters?: SortDto[];
}
