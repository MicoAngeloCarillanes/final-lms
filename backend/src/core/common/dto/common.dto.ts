// String value that may also be null or undefined.
export type StringNullUndefined = string | null | undefined;

// String value that may be null.
export type StringNull = string | null;

// String value that may be undefined.
export type StringUndefined = string | undefined;

// String value that may be number or symbol.
export type StringNumberSymbol = string | number | symbol;

// Number value that may also be null.
export type NumberNull = number | null;

// Number value that may also be null or undefined.
export type NumberNullUndefined = number | null | undefined;

// Date value that may also be null.
export type DateNull = Date | null;

// Tinyint flag type used for boolean-like database fields.
export type TinyIntFlag = 0 | 1;
