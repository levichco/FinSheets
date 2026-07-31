/**
 * Row / column GROUPING with functional collapse & expand — free-tier only.
 *
 * The Pro outline-gutter plugin (@univerjs-pro/sheets-outline) is license-gated
 * and off-limits (constitution Principle II). Instead we track groups in a small
 * module-level registry keyed by sheetId and realise collapse/expand by HIDING
 * and SHOWING the range's rows/columns through the free-tier Facade
 * (`FWorksheet.hideRows/showRows/hideColumns/showColumns`). No paid APIs, no new
 * deps — a genuinely working collapse/expand, menu-driven.
 *
 * State is session-scoped (survives sheet switches within a session, not save /
 * reload). Every Facade call is wrapped defensively so an edge case never throws.
 */
import type { UniverAPI } from "../core/create-sheet";

export type Orientation = "row" | "col";

export interface SheetGroup {
  id: string;
  orientation: Orientation;
  /** 0-based inclusive start index. */
  start: number;
  /** 0-based inclusive end index. */
  end: number;
  collapsed: boolean;
}

/* ---- Loose Facade view (free-tier FWorksheet hide/show surface) ------------ */
interface FRangeLike {
  getRow(): number;
  getLastRow(): number;
  getColumn(): number;
  getLastColumn(): number;
}
interface FWorksheetLike {
  getSheetId(): string;
  hideRows(rowIndex: number, numRow?: number): unknown;
  showRows(rowIndex: number, numRows?: number): unknown;
  hideColumns(columnIndex: number, numColumn?: number): unknown;
  showColumns(columnIndex: number, numColumns?: number): unknown;
  getActiveRange?(): FRangeLike | null;
}
interface FWorkbookLike {
  getActiveSheet(): FWorksheetLike | null | undefined;
  getActiveRange?(): FRangeLike | null;
}
interface FacadeLike {
  getActiveWorkbook(): FWorkbookLike | null | undefined;
}

function facade(api: UniverAPI): FacadeLike {
  return api as unknown as FacadeLike;
}
function activeSheet(api: UniverAPI): FWorksheetLike | null {
  try {
    return facade(api).getActiveWorkbook()?.getActiveSheet() ?? null;
  } catch {
    return null;
  }
}
function activeSheetId(api: UniverAPI): string | null {
  try {
    return activeSheet(api)?.getSheetId() ?? null;
  } catch {
    return null;
  }
}

/* ---- Registry ------------------------------------------------------------- */
/** groups per sheetId. Module-level closure state — session-scoped. */
const registry = new Map<string, SheetGroup[]>();
let seq = 0;

function groupsOf(sheetId: string): SheetGroup[] {
  let list = registry.get(sheetId);
  if (!list) {
    list = [];
    registry.set(sheetId, list);
  }
  return list;
}

/** Groups for the currently active sheet (menu state / checks). Empty if none. */
export function getGroupsForActiveSheet(api: UniverAPI): SheetGroup[] {
  const sid = activeSheetId(api);
  if (!sid) return [];
  // Return a copy so callers can't mutate the registry array directly.
  return groupsOf(sid).map((g) => ({ ...g }));
}

/* ---- hide / show plumbing ------------------------------------------------- */
function applyHidden(sheet: FWorksheetLike, g: SheetGroup, hidden: boolean): void {
  const count = g.end - g.start + 1;
  if (count <= 0) return;
  try {
    if (g.orientation === "row") {
      if (hidden) sheet.hideRows(g.start, count);
      else sheet.showRows(g.start, count);
    } else {
      if (hidden) sheet.hideColumns(g.start, count);
      else sheet.showColumns(g.start, count);
    }
  } catch {
    /* facade surface differs — collapse/expand is best-effort */
  }
}

/* ---- Grouping API --------------------------------------------------------- */
function normalise(start: number, end: number): [number, number] {
  const a = Math.max(0, Math.min(start, end));
  const b = Math.max(start, end);
  return [a, b];
}

/** Does group `g` overlap the inclusive [start,end] span (same orientation). */
function overlaps(g: SheetGroup, start: number, end: number): boolean {
  return g.start <= end && g.end >= start;
}

function addGroup(api: UniverAPI, orientation: Orientation, start: number, end: number): SheetGroup | null {
  const sid = activeSheetId(api);
  if (sid == null) return null;
  const [s, e] = normalise(start, end);
  if (e < s) return null;
  const list = groupsOf(sid);
  // Skip an exact duplicate so re-issuing the command is a no-op, not a pile-up.
  const dup = list.find((g) => g.orientation === orientation && g.start === s && g.end === e);
  if (dup) return dup;
  const g: SheetGroup = { id: `grp-${++seq}`, orientation, start: s, end: e, collapsed: false };
  list.push(g);
  return g;
}

/** Group a row range (0-based inclusive). Does not collapse it. */
export function groupRows(api: UniverAPI, start: number, end: number): SheetGroup | null {
  return addGroup(api, "row", start, end);
}

/** Group a column range (0-based inclusive). Does not collapse it. */
export function groupCols(api: UniverAPI, start: number, end: number): SheetGroup | null {
  return addGroup(api, "col", start, end);
}

/** Collapse a specific group (hide its rows/cols). Idempotent. */
export function collapseGroup(api: UniverAPI, group: SheetGroup): void {
  const sheet = activeSheet(api);
  const sid = activeSheetId(api);
  if (!sheet || sid == null) return;
  const g = groupsOf(sid).find((x) => x.id === group.id);
  if (!g) return;
  g.collapsed = true;
  applyHidden(sheet, g, true);
}

/** Expand a specific group (show its rows/cols). Idempotent. */
export function expandGroup(api: UniverAPI, group: SheetGroup): void {
  const sheet = activeSheet(api);
  const sid = activeSheetId(api);
  if (!sheet || sid == null) return;
  const g = groupsOf(sid).find((x) => x.id === group.id);
  if (!g) return;
  g.collapsed = false;
  applyHidden(sheet, g, false);
}

/**
 * Remove groups that intersect [start,end] in the given orientation, first
 * re-showing their rows/cols so ungroup never leaves data stranded/hidden.
 * Returns the number of groups removed.
 */
export function ungroup(api: UniverAPI, orientation: Orientation, start: number, end: number): number {
  const sheet = activeSheet(api);
  const sid = activeSheetId(api);
  if (!sheet || sid == null) return 0;
  const [s, e] = normalise(start, end);
  const list = groupsOf(sid);
  const hit = list.filter((g) => g.orientation === orientation && overlaps(g, s, e));
  for (const g of hit) {
    applyHidden(sheet, g, false); // un-hide before dropping the record
  }
  const remaining = list.filter((g) => !hit.includes(g));
  registry.set(sid, remaining);
  return hit.length;
}

/**
 * Collapse the groups intersecting [start,end] in the given orientation (the
 * ones under the current selection). Returns how many were affected.
 */
export function collapseGroupsInRange(api: UniverAPI, orientation: Orientation, start: number, end: number): number {
  const sheet = activeSheet(api);
  const sid = activeSheetId(api);
  if (!sheet || sid == null) return 0;
  const [s, e] = normalise(start, end);
  const hit = groupsOf(sid).filter((g) => g.orientation === orientation && overlaps(g, s, e));
  for (const g of hit) {
    g.collapsed = true;
    applyHidden(sheet, g, true);
  }
  return hit.length;
}

/** Expand the groups intersecting [start,end] in the given orientation. */
export function expandGroupsInRange(api: UniverAPI, orientation: Orientation, start: number, end: number): number {
  const sheet = activeSheet(api);
  const sid = activeSheetId(api);
  if (!sheet || sid == null) return 0;
  const [s, e] = normalise(start, end);
  const hit = groupsOf(sid).filter((g) => g.orientation === orientation && overlaps(g, s, e));
  for (const g of hit) {
    g.collapsed = false;
    applyHidden(sheet, g, false);
  }
  return hit.length;
}

/** Collapse every group on the active sheet. */
export function collapseAll(api: UniverAPI): void {
  const sheet = activeSheet(api);
  const sid = activeSheetId(api);
  if (!sheet || sid == null) return;
  for (const g of groupsOf(sid)) {
    g.collapsed = true;
    applyHidden(sheet, g, true);
  }
}

/** Expand every group on the active sheet. */
export function expandAll(api: UniverAPI): void {
  const sheet = activeSheet(api);
  const sid = activeSheetId(api);
  if (!sheet || sid == null) return;
  for (const g of groupsOf(sid)) {
    g.collapsed = false;
    applyHidden(sheet, g, false);
  }
}

/** True if the active sheet has any groups (menu enable/disable state). */
export function hasGroups(api: UniverAPI): boolean {
  const sid = activeSheetId(api);
  return sid != null && groupsOf(sid).length > 0;
}

/**
 * Read the active selection as an inclusive index span for the given
 * orientation (rows → row indices, cols → column indices). Returns null when
 * there's no selection. Used by the menu so "Group rows / columns" acts on the
 * current selection without the caller wiring selection plumbing itself.
 */
export function selectionSpan(api: UniverAPI, orientation: Orientation): [number, number] | null {
  try {
    const wb = facade(api).getActiveWorkbook();
    const range = wb?.getActiveRange?.() ?? wb?.getActiveSheet()?.getActiveRange?.() ?? null;
    if (!range) return null;
    if (orientation === "row") return normalise(range.getRow(), range.getLastRow());
    return normalise(range.getColumn(), range.getLastColumn());
  } catch {
    return null;
  }
}
