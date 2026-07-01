/**
 * Group by view — a Google-Sheets-style "group by a column" view, built on top
 * of Univer's free engine (no grouping feature exists in Univer, so this is
 * fully custom). See the research notes: a group view is a non-destructive view
 * over a table that, for each distinct value of the grouped column, shows a
 * **summary header** (group label + per-column aggregate) above that group's
 * rows, with the group **collapsible**.
 *
 * What we replicate (everything except per-column in-cell aggregation pickers):
 *   • sort by the chosen column so each value's rows are contiguous (the groups)
 *   • insert a styled summary header row per group: `▾ Col: value · N` + the
 *     SUM of each numeric column (Count is the `· N`)
 *   • collapse/expand a group by clicking its header's first cell (hide/show)
 *   • a green "Temporary group by …" banner with Save view / Exit (rendered by
 *     the toolbar)
 *
 * Reversible: `clearGroupView` removes the inserted rows and unhides everything.
 * Caveats (documented for the caller): the sort is not undone on exit (original
 * row order isn't restored), and editing the comment column while grouped is not
 * supported (row indices shift while a group view is active).
 */

interface FRangeLike {
  getValue(): string | number | boolean | null;
  getValues(): (string | number | boolean | null)[][];
  setValue(v: string | number): FRangeLike;
  setValues(v: (string | number)[][]): FRangeLike;
  setBackground(color: string): FRangeLike;
  setFontWeight(weight: string | null): FRangeLike;
  getRow(): number;
  getLastRow(): number;
  getColumn(): number;
  getLastColumn(): number;
}
interface WSLike {
  getFilter?(): { getRange(): FRangeLike } | null;
  getRange(row: number, column: number, numRows?: number, numColumns?: number): FRangeLike;
  getSheetId?(): string;
  getMaxColumns?(): number;
  insertRowsBefore(beforePosition: number, howMany: number): unknown;
  deleteRows(rowPosition: number, howMany: number): unknown;
  hideRows(rowIndex: number, numRows?: number): unknown;
  showRows(rowIndex: number, numRows?: number): unknown;
}
interface WBLike {
  getActiveSheet(): WSLike | null;
  getId?(): string;
}
/** Minimal Facade slice this module needs. */
export interface GroupByApi {
  getActiveWorkbook(): WBLike | null;
  executeCommand(id: string, params?: object): unknown;
}

/** A groupable column (from the header row). */
export interface GroupColumn {
  index: number;
  label: string;
}

/** A saved group-by view. */
export interface GroupView {
  id: string;
  name: string;
  colIndex: number;
}

/** Live state of an applied group view (the inserted header rows + ranges). */
export interface GroupRun {
  colIndex: number;
  startCol: number;
  groups: { headerRow: number; firstDataRow: number; lastDataRow: number; collapsed: boolean }[];
}

const isBlank = (v: unknown): boolean => v === null || v === undefined || String(v).trim() === "";
const norm = (v: unknown): string => (isBlank(v) ? "" : String(v));

function getFilterRange(api: GroupByApi | null): FRangeLike | null {
  const ws = api?.getActiveWorkbook()?.getActiveSheet();
  return ws?.getFilter?.()?.getRange?.() ?? null;
}

/** Ensure a filter exists so we have a well-defined data range to group. */
function ensureFilter(api: GroupByApi | null): void {
  if (!getFilterRange(api)) api?.executeCommand("sheet.command.smart-toggle-filter");
}

/**
 * Read the header-row labels for the groupable columns. Does NOT force a filter
 * on (so merely opening the menu has no side effect): uses the filter range if
 * present, else scans the first row and trims at the first empty header.
 */
export function getGroupColumns(api: GroupByApi | null): GroupColumn[] {
  try {
    return readGroupColumns(api);
  } catch {
    return []; // never let a facade hiccup crash the menu/Dropdown
  }
}

function readGroupColumns(api: GroupByApi | null): GroupColumn[] {
  const ws = api?.getActiveWorkbook()?.getActiveSheet();
  if (!ws) return [];
  const range = getFilterRange(api);
  const headerRow = range ? range.getRow() : 0;
  const startCol = range ? range.getColumn() : 0;
  // Clamp the scan to the sheet's real column count (getRange throws if the
  // range exceeds the grid — the sheet has far fewer than 40 columns).
  const maxCol = (ws.getMaxColumns?.() ?? 1) - 1;
  const endCol = range ? range.getLastColumn() : Math.min(startCol + 39, Math.max(startCol, maxCol));
  const span = Math.max(1, endCol - startCol + 1);
  const row = ws.getRange(headerRow, startCol, 1, span).getValues()[0] ?? [];
  const cols: GroupColumn[] = [];
  for (let i = 0; i < row.length; i++) {
    const v = row[i];
    if (v == null || String(v).trim() === "") {
      if (!range) break;
      continue;
    }
    cols.push({ index: startCol + i, label: String(v) });
  }
  return cols;
}

/** Format an aggregate value as currency (this sheet's numeric columns are $). */
function fmtMoney(n: number): string {
  const a = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `($${a})` : `$${a}`;
}

/**
 * Apply a full group-by view on a column: sort so equal values are contiguous,
 * then insert a styled summary header row above each group. Returns the live
 * GroupRun (header rows + data ranges) for collapse/exit, or null.
 */
export function buildGroupView(api: GroupByApi | null, colIndex: number): GroupRun | null {
  ensureFilter(api);
  const ws = api?.getActiveWorkbook()?.getActiveSheet();
  const range = getFilterRange(api);
  if (!ws || !range) return null;

  const headerRow = range.getRow();
  const startCol = range.getColumn();
  const endCol = range.getLastColumn();
  const width = endCol - startCol + 1;
  const colRel = colIndex - startCol;
  const firstData = headerRow + 1;
  let lastData = range.getLastRow();

  // Trim trailing footer/total rows (blank first column) so they're excluded
  // from the sort + grouping and stay put below the data.
  while (lastData > firstData && isBlank(ws.getRange(lastData, startCol).getValue())) lastData--;
  if (lastData < firstData) return null;

  const colLabel = norm(ws.getRange(headerRow, colIndex).getValue()) || "Group";

  // Sort by the group column so equal values are contiguous. SortRangeCommand
  // REQUIRES unitId + subUnitId — without them it silently no-ops (the data
  // stays in its original order and "groups" become tiny single-row runs).
  const unitId = api?.getActiveWorkbook()?.getId?.() ?? "";
  const subUnitId = ws.getSheetId?.() ?? "";
  api?.executeCommand("sheet.command.sort-range", {
    unitId,
    subUnitId,
    range: { startRow: headerRow, endRow: lastData, startColumn: startCol, endColumn: endCol },
    orderRules: [{ type: "asc", colIndex }],
    hasTitle: true,
  });

  // Read the (now sorted) data block.
  const values = ws.getRange(firstData, startCol, lastData - firstData + 1, width).getValues();
  if (!values.length) return null;

  // Detect numeric columns (for SUM). The group column is never aggregated.
  const numeric: boolean[] = [];
  for (let c = 0; c < width; c++) {
    let total = 0;
    let nums = 0;
    for (const r of values) {
      const v = r[c];
      if (isBlank(v)) continue;
      total++;
      if (typeof v === "number" || !Number.isNaN(Number(v))) nums++;
    }
    numeric[c] = total > 0 && nums / total > 0.6;
  }
  numeric[colRel] = false;

  // Walk contiguous runs → groups with per-column sums.
  type Raw = { value: unknown; firstOffset: number; count: number; sums: number[] };
  const raw: Raw[] = [];
  let i = 0;
  while (i < values.length) {
    const key = norm(values[i][colRel]);
    const sums = new Array(width).fill(0);
    let j = i;
    while (j < values.length && norm(values[j][colRel]) === key) {
      for (let c = 0; c < width; c++) {
        if (numeric[c]) {
          const n = Number(values[j][c]);
          if (!Number.isNaN(n)) sums[c] += n;
        }
      }
      j++;
    }
    raw.push({ value: values[i][colRel], firstOffset: i, count: j - i, sums });
    i = j;
  }

  // Insert one header row above each group (bottom-up keeps earlier indices
  // valid during insertion).
  for (let g = raw.length - 1; g >= 0; g--) ws.insertRowsBefore(firstData + raw[g].firstOffset, 1);

  // Write + style each header row; record final absolute indices.
  const groups: GroupRun["groups"] = [];
  for (let g = 0; g < raw.length; g++) {
    const hr = firstData + raw[g].firstOffset + g; // g headers inserted above this one
    const firstDataRow = hr + 1;
    const lastDataRow = firstDataRow + raw[g].count - 1;

    const cells: (string | number)[] = new Array(width).fill("");
    const valTxt = isBlank(raw[g].value) ? "(blank)" : String(raw[g].value);
    cells[0] = `▾  ${colLabel}: ${valTxt}   ·   ${raw[g].count}`;
    for (let c = 0; c < width; c++) if (numeric[c]) cells[c] = fmtMoney(raw[g].sums[c]);

    const hrRange = ws.getRange(hr, startCol, 1, width);
    hrRange.setValues([cells]);
    hrRange.setBackground("#eef2f6").setFontWeight("bold");

    groups.push({ headerRow: hr, firstDataRow, lastDataRow, collapsed: false });
  }

  return { colIndex, startCol, groups };
}

/** Collapse/expand the group whose header is on `headerRow`. */
export function toggleGroup(api: GroupByApi | null, run: GroupRun, headerRow: number): void {
  const ws = api?.getActiveWorkbook()?.getActiveSheet();
  if (!ws) return;
  const g = run.groups.find((x) => x.headerRow === headerRow);
  if (!g) return;
  const n = g.lastDataRow - g.firstDataRow + 1;
  if (g.collapsed) {
    ws.showRows(g.firstDataRow, n);
    g.collapsed = false;
  } else {
    ws.hideRows(g.firstDataRow, n);
    g.collapsed = true;
  }
  const cell = ws.getRange(headerRow, run.startCol);
  const cur = String(cell.getValue() ?? "");
  cell.setValue(cur.replace(/^[▾▸]/, g.collapsed ? "▸" : "▾"));
}

/** Remove a group view: unhide everything + delete the inserted header rows. */
export function clearGroupView(api: GroupByApi | null, run: GroupRun): void {
  const ws = api?.getActiveWorkbook()?.getActiveSheet();
  if (!ws) return;
  const bottomUp = [...run.groups].sort((a, b) => b.headerRow - a.headerRow);
  for (const g of bottomUp) {
    if (g.collapsed) ws.showRows(g.firstDataRow, g.lastDataRow - g.firstDataRow + 1);
    ws.deleteRows(g.headerRow, 1);
  }
}

/* ---- Persistence (mirrors filter-views) ----------------------------------- */
function groupViewsKey(api: GroupByApi | null): string {
  const sid = api?.getActiveWorkbook()?.getActiveSheet()?.getSheetId?.() ?? "default";
  return `levich:group-views:${sid}`;
}

/** Load saved group views for this sheet. */
export function loadGroupViews(api: GroupByApi | null): GroupView[] {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(groupViewsKey(api)) : null;
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as GroupView[]) : [];
  } catch {
    return [];
  }
}

/** Persist this sheet's group views. */
export function saveGroupViews(api: GroupByApi | null, views: GroupView[]): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(groupViewsKey(api), JSON.stringify(views));
  } catch {
    /* ignore */
  }
}
