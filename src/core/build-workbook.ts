/**
 * Compiles consumer data + column definitions (+ layout config) into a Univer
 * IWorkbookData snapshot. Generalized from the flux-poc transaction builder so
 * columns are consumer-defined rather than hard-coded (constitution Principle IV).
 */
import { buildCellStyle, normalizeSymbol } from "../features/formatting";
import type { BuiltWorkbook, Cell, CellStyle, ColumnDef, FooterConfig, FreezeConfig, SheetData, WorkbookData } from "./types";

const HEADER_STYLE: CellStyle = { bl: 1, bg: { rgb: "#F9FAFB" }, cl: { rgb: "#475467" } };
const DEFAULT_COLUMN_WIDTH = 140;
const ROW_HEADROOM = 50; // extra blank rows so users can type formulas below the data
const COLUMN_HEADROOM = 4;

const SHEET_ID = "levich-sheet";
const WORKBOOK_ID = "levich-workbook";

export interface BuildWorkbookOptions {
  freeze?: FreezeConfig;
  currencySymbol?: string | null;
  /** Pre-fill for the comment column, keyed by row key. */
  comments?: Record<string, string>;
  /** Restore saved column widths, keyed by column index. */
  columnWidths?: Record<number, number>;
  /** Stable per-row keys (index-aligned with `data`). */
  rowKeys?: string[];
  /** Column key whose cells accept the `comments` pre-fill. */
  commentColumnKey?: string;
  /** Optional totals row with a live SUM over one column. */
  footer?: FooterConfig;
  /**
   * Optional extra cell region (e.g. a pivot result) merged on top of the grid.
   * Keyed `cellData[row][col]`. Rows here are absolute sheet rows.
   */
  extraCells?: Record<number, Record<number, Cell>>;
  /** Total rows/columns hint when `extraCells` extends past the data block. */
  extraRows?: number;
  extraColumns?: number;
}

/** Resolve a `FreezeConfig` into Univer's freeze descriptor. */
export function resolveFreeze(freeze: FreezeConfig | undefined): {
  xSplit: number;
  ySplit: number;
  startRow: number;
  startColumn: number;
} {
  if (freeze === false) {
    return { xSplit: 0, ySplit: 0, startRow: 0, startColumn: 0 };
  }
  const rows = freeze?.rows ?? 1;
  const columns = freeze?.columns ?? 0;
  return { xSplit: columns, ySplit: rows, startRow: rows, startColumn: columns };
}

/** Convert a 0-based column index to a spreadsheet column letter (0 → A). */
export function columnLetter(index: number): string {
  let n = index;
  let letter = "";
  do {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letter;
}

function toCell(value: unknown, style?: CellStyle): Cell {
  if (value === undefined || value === null) {
    return style ? { v: "", s: style } : { v: "" };
  }
  if (typeof value === "number" || typeof value === "string") {
    return style ? { v: value, s: style } : { v: value };
  }
  return style ? { v: String(value), s: style } : { v: String(value) };
}

function buildColumnData(columns: ColumnDef[], saved?: Record<number, number>): Record<number, { w: number }> {
  const columnData: Record<number, { w: number }> = {};
  columns.forEach((col, c) => {
    columnData[c] = { w: col.width && col.width > 0 ? col.width : DEFAULT_COLUMN_WIDTH };
  });
  if (saved) {
    for (const [k, w] of Object.entries(saved)) {
      const idx = Number(k);
      if (Number.isFinite(idx) && typeof w === "number" && w > 0) columnData[idx] = { w };
    }
  }
  return columnData;
}

/**
 * Build a workbook snapshot:
 *  - row 0: bold header on a subtle fill
 *  - rows 1..N: data, formatted per column
 *  - optional `extraCells` (e.g. a pivot region) overlaid
 */
export function buildWorkbook(data: SheetData, columns: ColumnDef[], options: BuildWorkbookOptions = {}): BuiltWorkbook {
  const symbol = normalizeSymbol(options.currencySymbol);
  const comments = options.comments ?? {};
  const rowKeys = options.rowKeys ?? data.map((_, i) => String(i));

  const cellData: Record<number, Record<number, Cell>> = {};

  // Header row.
  cellData[0] = {};
  columns.forEach((col, c) => {
    cellData[0][c] = { v: col.header, s: HEADER_STYLE };
  });

  // Data rows.
  data.forEach((record, i) => {
    const rowIdx = i + 1;
    const rowKey = rowKeys[i] ?? String(i);
    const row: Record<number, Cell> = {};
    columns.forEach((col, c) => {
      const style = buildCellStyle(col, symbol);
      let value = record[col.key];
      if (options.commentColumnKey && col.key === options.commentColumnKey) {
        const seeded = comments[rowKey];
        value = seeded !== undefined ? seeded : value ?? "";
      }
      row[c] = toCell(value, style);
    });
    cellData[rowIdx] = row;
  });

  // Optional footer/totals row with a live SUM.
  let footerRowIndex: number | undefined;
  if (options.footer) {
    const footer = options.footer;
    const sumColIndex = columns.findIndex((c) => c.key === footer.sumColumnKey);
    if (sumColIndex >= 0) {
      footerRowIndex = data.length + 1;
      let labelColIndex = footer.labelColumnKey
        ? columns.findIndex((c) => c.key === footer.labelColumnKey)
        : Math.max(0, sumColIndex - 1);
      // Never place the label in the SUM cell (it would overwrite the formula).
      if (labelColIndex === sumColIndex) labelColIndex = Math.max(0, sumColIndex - 1);
      const labelStyle: CellStyle = { bl: 1, bg: { rgb: "#F9FAFB" } };
      const moneyStyle: CellStyle = { ...(buildCellStyle(columns[sumColIndex], symbol) ?? {}), bl: 1, bg: { rgb: "#F9FAFB" } };
      const row: Record<number, Cell> = {};
      row[labelColIndex] = { v: footer.label, s: labelStyle };
      if (data.length > 0) {
        const letter = columnLetter(sumColIndex);
        row[sumColIndex] = { f: `=SUM(${letter}2:${letter}${data.length + 1})`, s: moneyStyle };
      } else {
        row[sumColIndex] = { v: 0, s: moneyStyle };
      }
      cellData[footerRowIndex] = { ...(cellData[footerRowIndex] ?? {}), ...row };
    }
  }

  // Overlay extra cells (pivot region etc.).
  if (options.extraCells) {
    for (const [r, cols] of Object.entries(options.extraCells)) {
      const rowIdx = Number(r);
      cellData[rowIdx] = { ...(cellData[rowIdx] ?? {}), ...cols };
    }
  }

  const occupiedRows = (footerRowIndex !== undefined ? footerRowIndex + 1 : data.length + 1); // header + data (+ footer)
  const totalRows = Math.max(occupiedRows, options.extraRows ?? 0) + ROW_HEADROOM;
  const totalColumns = Math.max(columns.length, options.extraColumns ?? 0) + COLUMN_HEADROOM;

  const workbookData: WorkbookData = {
    id: WORKBOOK_ID,
    name: "Sheet",
    sheetOrder: [SHEET_ID],
    sheets: {
      [SHEET_ID]: {
        id: SHEET_ID,
        name: "Sheet1",
        rowCount: totalRows,
        columnCount: totalColumns,
        cellData,
        columnData: buildColumnData(columns, options.columnWidths),
        defaultColumnWidth: DEFAULT_COLUMN_WIDTH,
        freeze: resolveFreeze(options.freeze),
      },
    },
  };

  return {
    workbookData,
    rowCount: data.length,
    headerRowIndex: 0,
    footerRowIndex,
    columnCount: columns.length,
  };
}
