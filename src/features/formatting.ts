/**
 * Number/date formatting for columns. Formats are applied as Univer number
 * patterns (Excel pattern grammar) so the underlying value stays numeric and
 * formulas + export keep working.
 */
import type { CellStyle, ColumnDef } from "../core/types";

/** Univer HorizontalAlign.RIGHT (avoids importing the enum). */
export const ALIGN_RIGHT = 3;

/** Default ISO date display. */
export const DATE_PATTERN = "yyyy-mm-dd";

/** Default thousands-separated number pattern. */
export const NUMBER_PATTERN = "#,##0.00";

/** Normalize a currency symbol, defaulting to `$`. */
export function normalizeSymbol(symbol?: string | null): string {
  return symbol && symbol.trim() ? symbol.trim() : "$";
}

/** Accounting-style currency pattern: positives plain, negatives in parentheses. */
export function currencyPattern(symbol: string): string {
  const s = `"${symbol}"`;
  return `${s}#,##0.00;(${s}#,##0.00)`;
}

/** Build the inline style for a column's data cells, or `undefined` for plain text. */
export function buildCellStyle(column: ColumnDef, symbol: string): CellStyle | undefined {
  switch (column.format) {
    case "currency":
      return { n: { pattern: currencyPattern(symbol) }, ht: ALIGN_RIGHT };
    case "number":
      return { n: { pattern: NUMBER_PATTERN }, ht: ALIGN_RIGHT };
    case "date":
      return { n: { pattern: DATE_PATTERN } };
    case "text":
    default:
      return undefined;
  }
}
