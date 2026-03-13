import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsString } from 'class-validator';
import { transformToSortDirection } from '../util/pagination.util';

/**
 * DTO for a single sorting rule used in list/search requests.
 */
export class SortDto {
    @ApiProperty({
        example: 'name',
        description: 'Field name to sort by (API field name, not DB column).'
    })
    @IsString()
    sortBy: string;

    @ApiProperty({
        example: 'ASC',
        enum: ['ASC', 'DESC'],
        description: 'Sort direction. Accepts any casing of asc/desc.'
    })
    @Transform(({ value }) => transformToSortDirection(String(value)))
    @IsString()
    @IsIn(['ASC', 'DESC'])
    sortDirection: 'ASC' | 'DESC';
}
