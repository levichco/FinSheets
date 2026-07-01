/**
 * Free, configuration-based pivot engine. Groups + aggregates the supplied data
 * in code and emits the result as ordinary styled cells, which the free Univer
 * engine renders and the ExcelJS export preserves at full fidelity. No Univer
 * Pro pivot (constitution Principle II).
 */
import { ALIGN_RIGHT, NUMBER_PATTERN } from "./formatting";
import type { Cell, CellStyle, PivotAggregate, PivotConfig, SheetData } from "../core/types";

export interface PivotResult {
  rowKeys: string[];
  colKeys: string[];
  /** cells[rowKey][colKey] = aggregated value. */
  cells: Record<string, Record<string, number>>;
  rowTotals: Record<string, number>;
  colTotals: Record<string, number>;
  grandTotal: number;
}

function keyOf(record: Record<string, unknown>, fields: string[]): string {
  return fields.map((f) => String(record[f] ?? "")).join(" / ");
}

function aggregatorFor(aggregate: PivotAggregate): (values: number[]) => number {
  switch (aggregate) {
    case "count":
      return (v) => v.length;
    case "average":
      return (v) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0);
    case "min":
      return (v) => (v.length ? Math.min(...v) : 0);
    case "max":
      return (v) => (v.length ? Math.max(...v) : 0);
    case "sum":
    default:
      return (v) => v.reduce((s, x) => s + x, 0);
  }
}

/** Compute a pivot from in-memory data (single value field, v1). */
export function computePivot(data: SheetData, config: PivotConfig): PivotResult {
  const valueField = config.values[0];
  const agg = aggregatorFor(config.aggregate);

  const rowKeys: string[] = [];
  const colKeys: string[] = [];
  const rowSeen = new Set<string>();
  const colSeen = new Set<string>();
  const buckets = new Map<string, Map<string, number[]>>();

  for (const record of data) {
    const rk = keyOf(record, config.rows);
    const ck = config.columns.length ? keyOf(record, config.columns) : "Total";
    if (!rowSeen.has(rk)) {
      rowSeen.add(rk);
      rowKeys.push(rk);
    }
    if (!colSeen.has(ck)) {
      colSeen.add(ck);
      colKeys.push(ck);
    }
    const num = Number(record[valueField]);
    const value = Number.isFinite(num) ? num : 0;
    if (!buckets.has(rk)) buckets.set(rk, new Map());
    const row = buckets.get(rk)!;
    if (!row.has(ck)) row.set(ck, []);
    row.get(ck)!.push(value);
  }

  const cells: Record<string, Record<string, number>> = {};
  const rowTotals: Record<string, number> = {};
  const colTotals: Record<string, number> = {};
  let grandValues: number[] = [];

  for (const rk of rowKeys) {
    cells[rk] = {};
    let rowValues: number[] = [];
    for (const ck of colKeys) {
      const vals = buckets.get(rk)?.get(ck) ?? [];
      cells[rk][ck] = agg(vals);
      rowValues = rowValues.concat(vals);
    }
    rowTotals[rk] = agg(rowValues);
    grandValues = grandValues.concat(rowValues);
  }

  for (const ck of colKeys) {
    let colValues: number[] = [];
    for (const rk of rowKeys) {
      colValues = colValues.concat(buckets.get(rk)?.get(ck) ?? []);
    }
    colTotals[ck] = agg(colValues);
  }

  return { rowKeys, colKeys, cells, rowTotals, colTotals, grandTotal: agg(grandValues) };
}

const HEADER_STYLE: CellStyle = { bl: 1, bg: { rgb: "#F9FAFB" }, cl: { rgb: "#475467" } };
const TOTAL_LABEL_STYLE: CellStyle = { bl: 1, bg: { rgb: "#F9FAFB" } };
const NUM_STYLE: CellStyle = { n: { pattern: NUMBER_PATTERN }, ht: ALIGN_RIGHT };
const NUM_TOTAL_STYLE: CellStyle = { n: { pattern: NUMBER_PATTERN }, ht: ALIGN_RIGHT, bl: 1, bg: { rgb: "#F9FAFB" } };

/** Render a pivot result into a cell region (header + rows + grand total). */
export function buildPivotCells(result: PivotResult): {
  cells: Record<number, Record<number, Cell>>;
  rowCount: number;
  columnCount: number;
} {
  const cells: Record<number, Record<number, Cell>> = {};
  const totalCol = result.colKeys.length + 1;

  // Header row.
  cells[0] = { 0: { v: "", s: HEADER_STYLE } };
  result.colKeys.forEach((ck, j) => {
    cells[0][j + 1] = { v: ck, s: HEADER_STYLE };
  });
  cells[0][totalCol] = { v: "Total", s: HEADER_STYLE };

  // Row-group rows.
  result.rowKeys.forEach((rk, i) => {
    const r = i + 1;
    cells[r] = { 0: { v: rk } };
    result.colKeys.forEach((ck, j) => {
      cells[r][j + 1] = { v: result.cells[rk][ck], s: NUM_STYLE };
    });
    cells[r][totalCol] = { v: result.rowTotals[rk], s: NUM_TOTAL_STYLE };
  });

  // Grand-total row.
  const gr = result.rowKeys.length + 1;
  cells[gr] = { 0: { v: "Grand Total", s: TOTAL_LABEL_STYLE } };
  result.colKeys.forEach((ck, j) => {
    cells[gr][j + 1] = { v: result.colTotals[ck], s: NUM_TOTAL_STYLE };
  });
  cells[gr][totalCol] = { v: result.grandTotal, s: NUM_TOTAL_STYLE };

  return { cells, rowCount: gr + 1, columnCount: totalCol + 1 };
}
