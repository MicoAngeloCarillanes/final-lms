import { Pool, RowDataPacket } from 'mysql2/promise';
import { DatabaseService } from 'src/database/service/database.service';
// prettier-ignore
import { StringNumberSymbol } from '../dto/common.dto';
import { sanitizeNumberValue } from '../util/clean.util';

/**
 * Base repository class for shared database access logic.
 *
 * Extend this class for feature-specific repositories to reuse common query helpers,
 * duplicate checks, pagination utilities, and other SQL-related operations.
 */
export abstract class BaseRepository {
    protected readonly pool: Pool;

    constructor(databaseService: DatabaseService) {
        this.pool = databaseService.getPool();
    }

    // prettier-ignore
    /**
     * Checks whether a non-deleted row exists in a table for a given duplicate field value,
     * excluding a specific row ID when provided (commonly used for update validations).
     *
     * @template T row shape returned by mysql2 query (must extend RowDataPacket).
     * @template D allowed keys for duplicate field lookup.
     * @param duplicateColumn the duplicate field key to resolve from the whitelist map.
     * @param value the value to check for duplicates.
     * @param tableName the database table name (must be trusted/internal).
     * @param duplicateFieldColumns whitelist map of allowed duplicate fields to actual DB columns.
     * @param excludedId the row ID to exclude from the duplicate check (used for update).
     * @returns true if a duplicate exists; otherwise, false.
     */
    async existsByFieldAndIdNot<
        T extends RowDataPacket,
        D extends StringNumberSymbol
    >(
        duplicateColumn: D,
        value: string,
        tableName: string,
        duplicateFieldColumns: Record<D, string>,
        excludedId?: number
    ): Promise<boolean> {
        if (value == null) {
            return false;
        }

        const sanitizedexcludedId = sanitizeNumberValue(excludedId);
        const [rows] = await this.pool.query<T[]>(
            `SELECT
                ${tableName}_id AS ${tableName}Id
            FROM
                ${tableName}
            WHERE
                ${duplicateFieldColumns[duplicateColumn]} = ?
                AND is_deleted = 0
                AND (? IS NULL OR ${tableName}_id <> ?)
            LIMIT 1`,
            [
                value,
                sanitizedexcludedId,
                sanitizedexcludedId
            ]
        );

        return Boolean(rows.length);
    }
}
