import { stringValueOrEmpty } from 'src/core/common/util/clean.util';
import { PaginationRequestDto } from '../dto/pagination-request.dto';

// prettier-ignore
/**
 * Normalizes a value to 'ASC' or 'DESC'.
 * Defaults to 'ASC' if the input is invalid or not a string.
 *
 * @param value  the raw input to be normalized.
 * @returns 'ASC' or 'DESC'.
 */
export function transformToSortDirection(value: string): 'ASC' | 'DESC' {
    const normalized = String(value)
        .trim()
        .toUpperCase();

    return normalized === 'DESC' ? 'DESC' : 'ASC';
}

// prettier-ignore
/**
 * Builds a safe ORDER BY SQL clause from pagination sort parameters.
 * Only sortable columns provided in the whitelist map will be used.
 *
 * @param pagination pagination request DTO containing sort parameters.
 * @param sortableColumns API field name to SQL column mapping.
 * @param defaultOrderBy fallback ORDER BY clause when no valid sort is provided.
 * @returns SQL ORDER BY clause.
 */
export function buildOrderByClause(
    pagination: Pick<PaginationRequestDto, 'sortParameters'>,
    sortableColumns: Record<string, string>,
    defaultOrderBy: string
): string {
    const sortParameters = pagination.sortParameters ?? [];
    const orderTokens: string[] = [];

    for (const sortParameter of sortParameters) {
        const column = sortableColumns[sortParameter.sortBy];

        if (stringValueOrEmpty(column)) {
            orderTokens.push(`${column} ${transformToSortDirection(sortParameter.sortDirection)}`);
        }
    }

    return !orderTokens.length
        ? defaultOrderBy
        : `ORDER BY
            ${orderTokens.join(',\n')}
        `;
}
