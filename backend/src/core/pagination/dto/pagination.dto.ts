import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for paginated list response metadata and data payload.
 */
export class PaginationSortStateDto {
    @ApiProperty({
        example: true,
        description: 'True if no sorting is applied'
    })
    empty: boolean;

    @ApiProperty({
        example: false,
        description: 'True if the result set is sorted'
    })
    sorted: boolean;

    @ApiProperty({
        example: true,
        description: 'True if the result set is unsorted'
    })
    unsorted: boolean;
}

/**
 * DTO for pageable metadata inside paginated list responses.
 */
export class PageableDto {
    @ApiProperty({
        example: 0,
        description: 'Current page index (zero-based)'
    })
    pageNumber: number;

    @ApiProperty({
        example: 5,
        description: 'Number of items per page'
    })
    pageSize: number;

    @ApiProperty({
        type: PaginationSortStateDto,
        description: 'Sorting state of the request'
    })
    sort: PaginationSortStateDto;

    @ApiProperty({
        example: 0,
        description: 'Offset from the start of the data set'
    })
    offset: number;

    @ApiProperty({
        example: false,
        description: 'True if the response is not paged'
    })
    unpaged: boolean;

    @ApiProperty({
        example: true,
        description: 'True if the response is paged'
    })
    paged: boolean;
}

/**
 * DTO for paginated list response, following a Spring-style pagination structure.
 */
export class PaginationDTO<T> {
    @ApiProperty({
        isArray: true,
        description: 'The array of data items'
    })
    content: T[];

    @ApiProperty({
        type: PageableDto,
        description: 'Pagination configuration and state'
    })
    pageable: PageableDto;

    @ApiProperty({
        example: true,
        description: 'True if this is the last page'
    })
    last: boolean;

    @ApiProperty({
        example: 5,
        description: 'Total count of elements across all pages'
    })
    totalElements: number;

    @ApiProperty({
        example: 1,
        description: 'Total number of pages available'
    })
    totalPages: number;

    @ApiProperty({
        example: 5,
        description: 'Size of the requested page'
    })
    size: number;

    @ApiProperty({
        example: 0,
        description: 'Current page number'
    })
    number: number;

    @ApiProperty({
        type: PaginationSortStateDto,
        description: 'Sorting status of the current page'
    })
    sort: PaginationSortStateDto;

    @ApiProperty({
        example: true,
        description: 'True if this is the first page'
    })
    first: boolean;

    @ApiProperty({
        example: 5,
        description: 'Actual number of elements in the current page'
    })
    numberOfElements: number;

    @ApiProperty({
        example: false,
        description: 'True if the page contains no data'
    })
    empty: boolean;
}
