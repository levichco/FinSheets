/**
 * Filter Views — a Google-Sheets-style "saved filter view" feature built on top
 * of Univer's existing filter engine.
 *
 * Univer's free plan has NO filter-view concept (single active filter per
 * sheet). A "view" here is simply a SNAPSHOT of every filter-range column's
 * criteria, captured through the public Facade (`FFilter.getColumnFilterCriteria`)
 * and re-applied later (`setColumnFilterCriteria` / `removeColumnFilterCriteria`).
 * All state lives in the toolbar (React); the engine is untouched — so this is
 * non-destructive and reversible, exactly like Google's filter views.
 */

interface FRangeLike {
  getColumn(): number;
  getLastColumn(): number;
}
interface FFilterLike {
  getRange(): FRangeLike;
  getColumnFilterCriteria(col: number): unknown | null;
  setColumnFilterCriteria(col: number, criteria: unknown): unknown;
  removeColumnFilterCriteria(col: number): unknown;
}
interface WSLike {
  getFilter?(): FFilterLike | null;
  getSheetId?(): string;
}
interface WBLike {
  getActiveSheet(): WSLike | null;
}
/** Minimal slice of the toolbar's Facade API this module needs. */
export interface FilterViewApi {
  getActiveWorkbook(): WBLike | null;
  executeCommand(id: string, params?: object): unknown;
}

/** One column's saved criteria (null = no filter on that column). */
export interface ColCriteria {
  col: number;
  criteria: unknown | null;
}

/** A named, saved snapshot of the whole sheet's per-column filter criteria. */
export interface FilterView {
  id: string;
  name: string;
  cols: ColCriteria[];
  /**
   * The sort that was active when the view was saved (Google's `sortSpecs`).
   * Stored as the full `sheet.command.sort-range` params so applying a view
   * reproduces the exact sorted order. `null`/absent = no sort captured.
   */
  sort?: unknown | null;
}

/** Command id Univer uses to (re-)apply a range sort. */
const SORT_RANGE_CMD = "sheet.command.sort-range";

function getFilter(api: FilterViewApi | null): FFilterLike | null {
  return api?.getActiveWorkbook()?.getActiveSheet()?.getFilter?.() ?? null;
}

/** Is there an active filter on the sheet? */
export function hasFilter(api: FilterViewApi | null): boolean {
  return !!getFilter(api);
}

/** Create a filter over the current data range if none exists. */
export function ensureFilter(api: FilterViewApi | null): void {
  if (!getFilter(api)) api?.executeCommand("sheet.command.smart-toggle-filter");
}

/** Capture the current per-column criteria across the whole filter range. */
export function snapshotFilters(api: FilterViewApi | null): ColCriteria[] {
  const f = getFilter(api);
  if (!f) return [];
  const range = f.getRange();
  const cols: ColCriteria[] = [];
  for (let c = range.getColumn(); c <= range.getLastColumn(); c++) {
    cols.push({ col: c, criteria: f.getColumnFilterCriteria(c) ?? null });
  }
  return cols;
}

/** Re-apply a saved view: per-column criteria + the saved sort order. */
export function applyFilterView(api: FilterViewApi | null, view: FilterView): void {
  ensureFilter(api);
  const f = getFilter(api);
  if (!f) return;
  for (const { col, criteria } of view.cols) {
    if (criteria) f.setColumnFilterCriteria(col, criteria);
    else f.removeColumnFilterCriteria(col);
  }
  // Reproduce the saved sort order (Google's sortSpecs) if one was captured.
  if (view.sort) api?.executeCommand(SORT_RANGE_CMD, view.sort as object);
}

/** Clear all per-column criteria (keeps the filter on, just unfiltered). */
export function clearAllFilters(api: FilterViewApi | null): void {
  const f = getFilter(api);
  if (!f) return;
  const range = f.getRange();
  for (let c = range.getColumn(); c <= range.getLastColumn(); c++) f.removeColumnFilterCriteria(c);
}

/* ---- Persistence ---------------------------------------------------------- */
/* Google auto-saves filter views with the document. We persist to localStorage,
   keyed per sheet, so saved views survive a reload. */

/** localStorage key for this sheet's saved views. */
export function viewsStorageKey(api: FilterViewApi | null): string {
  const sid = api?.getActiveWorkbook()?.getActiveSheet()?.getSheetId?.() ?? "default";
  return `levich:filter-views:${sid}`;
}

/** Load saved views for this sheet (empty array on any error). */
export function loadViews(api: FilterViewApi | null): FilterView[] {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(viewsStorageKey(api)) : null;
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as FilterView[]) : [];
  } catch {
    return [];
  }
}

/** Persist this sheet's views. */
export function saveViews(api: FilterViewApi | null, views: FilterView[]): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(viewsStorageKey(api), JSON.stringify(views));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}
