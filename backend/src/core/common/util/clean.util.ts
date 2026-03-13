// prettier-ignore
import { NumberNull, NumberNullUndefined, StringNull, StringNullUndefined } from '../dto/common.dto';

/**
 * Returns the first row in the array, or null if the array is empty.
 *
 * @param rows the result rows array.
 * @return the first row, or null when no rows exist.
 */
export function getFirstRowOrNull<T>(rows: T[]): T | null {
    return rows[0] ?? null;
}

/**
 * Converts string value that is null/undefined to an empty string.
 *
 * @param value the string value to clean.
 * @return the cleaned string.
 */
export function stringValueOrEmpty(value: StringNullUndefined): string {
    return value ?? '';
}

/**
 * Normalizes a nullable string value by converting undefined to null.
 * Useful for preparing optional string fields for database inserts/updates.
 *
 * @param value the string value to normalize.
 * @returns the original string, or null if the value is null or undefined.
 */
export function stringValueOrNull(value: StringNullUndefined): StringNull {
    return value ?? null;
}

/**
 * Normalizes a number to a number.
 * Defaults to a specified fallback if the input is null, undefined, or not a number.
 *
 * @param number the raw input to be normalized.
 * @returns a number.
 */
export function sanitizeNumberValue(number: NumberNullUndefined): NumberNull {
    if (typeof number === 'number' && !Number.isNaN(number)) {
        return Number(number);
    } else if (number == null) {
        return null;
    } else {
        return 0;
    }
}
