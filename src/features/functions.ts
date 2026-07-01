/**
 * Functions (Σ) — insert spreadsheet functions into the active cell, like
 * Google Sheets' Σ menu. Univer's formula engine (bundled in the core preset)
 * already evaluates every standard function when typed (`=SUM(...)`, etc.); this
 * module just makes them discoverable and one-click insertable:
 *
 *   • Quick aggregates (SUM / AVERAGE / COUNT / MAX / MIN) write a COMPLETE
 *     formula with an auto-detected range (contiguous numbers above, else to the
 *     left) — so the result computes immediately.
 *   • Any catalogued function inserts `=NAME()` and drops the user into edit mode
 *     to fill the arguments.
 */

interface FRangeLike {
  getRow(): number;
  getColumn(): number;
  getValue(): string | number | boolean | null;
  setValue(v: string | number): unknown;
}
interface WSLike {
  getRange(row: number, column: number, numRows?: number, numColumns?: number): FRangeLike;
}
interface WBLike {
  getActiveSheet(): WSLike | null;
  getActiveRange(): FRangeLike | null;
}
export interface FunctionsApi {
  getActiveWorkbook(): WBLike | null;
  executeCommand(id: string, params?: object): unknown;
}

const isNumeric = (v: unknown): boolean => typeof v === "number" || (v != null && String(v).trim() !== "" && !Number.isNaN(Number(v)));

/** 0-based column index → A1 letters (0→A, 25→Z, 26→AA). */
function colToA1(col: number): string {
  let s = "";
  let n = col;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export type Aggregate = "SUM" | "AVERAGE" | "COUNT" | "MAX" | "MIN";

/**
 * Insert `=FN(range)` in the active cell, auto-detecting the range the way
 * Google does: the contiguous run of numbers directly above the cell, or — if
 * there are none above — directly to the left. Falls back to an empty `=FN()`
 * (edit mode) when nothing numeric is adjacent.
 */
export function insertAggregate(api: FunctionsApi | null, fn: Aggregate): void {
  try {
    const wb = api?.getActiveWorkbook();
    const ws = wb?.getActiveSheet();
    const cell = wb?.getActiveRange();
    if (!wb || !ws || !cell) return;
    const r = cell.getRow();
    const c = cell.getColumn();

    // Scan up.
    let top = r - 1;
    while (top >= 0 && isNumeric(ws.getRange(top, c).getValue())) top--;
    top++;
    if (top <= r - 1) {
      cell.setValue(`=${fn}(${colToA1(c)}${top + 1}:${colToA1(c)}${r})`);
      return;
    }

    // Scan left.
    let left = c - 1;
    while (left >= 0 && isNumeric(ws.getRange(r, left).getValue())) left--;
    left++;
    if (left <= c - 1) {
      cell.setValue(`=${fn}(${colToA1(left)}${r + 1}:${colToA1(c - 1)}${r + 1})`);
      return;
    }

    insertFunctionTemplate(api, fn);
  } catch {
    /* insertion is best-effort — never block the menu from closing */
  }
}

/** Insert `=NAME()` into the active cell and open the editor to fill arguments. */
export function insertFunctionTemplate(api: FunctionsApi | null, name: string): void {
  try {
    const cell = api?.getActiveWorkbook()?.getActiveRange();
    if (!cell) return;
    cell.setValue(`=${name}()`);
    // Open the in-cell editor so the user can type the arguments between the
    // parentheses (no-op on locked cells, where edit-start is vetoed).
    api?.executeCommand("sheet.operation.set-cell-edit-visible", { visible: true, eventType: 3 });
  } catch {
    /* insertion / edit mode is best-effort */
  }
}

// The browsable catalogue (all 500+ functions, by category) lives in the
// generated `function-catalog.generated.ts`, sourced directly from Univer's
// engine so the menu always matches what the engine can evaluate.
