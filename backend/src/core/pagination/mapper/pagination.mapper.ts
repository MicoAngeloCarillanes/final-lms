import { PaginationDTO } from '../dto/pagination.dto';

// prettier-ignore
/**
 * Creates a Spring-style pagination DTO from request pagination and list results.
 *
 * @param content current page content.
 * @param page requested page number (1-based).
 * @param size requested page size.
 * @param totalElements total matching row count.
 * @param numberOfElements current page row count.
 * @param isSorted whether at least one sort parameter was applied.
 * @returns paginated response DTO.
 */
export function toPaginationDto<T>(
    content: T[],
    page: number,
    size: number,
    totalElements: number,
    numberOfElements: number,
    isSorted: boolean
): PaginationDTO<T> {
    const zeroBasedPageNumber = Math.max(page - 1, 0);
    const totalPages = size > 0
        ? Math.ceil(totalElements / size)
        : 0;
    const islast = totalPages === 0
        ? true
        : zeroBasedPageNumber >= totalPages - 1;
    const sortState = {
        empty: !isSorted,
        sorted: isSorted,
        unsorted: !isSorted
    };

    return {
        content,
        pageable: {
            pageNumber: zeroBasedPageNumber,
            pageSize: size,
            sort: sortState,
            offset: zeroBasedPageNumber * size,
            unpaged: false,
            paged: true
        },
        last: islast,
        totalElements,
        totalPages,
        size,
        number: zeroBasedPageNumber,
        sort: sortState,
        first: zeroBasedPageNumber === 0,
        numberOfElements,
        empty: numberOfElements === 0
    };
}
