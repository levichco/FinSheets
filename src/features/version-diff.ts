/**
 * Version diff — the "Highlight changes" engine (Google-Sheets-exact).
 *
 * Compares a version against its predecessor per sheet, cell by cell, and can
 * bake the changed cells into a preview snapshot as highlighted cells (+ optional
 * hiding of unmodified rows). Browser-only, pure data — no Univer imports.
 */
import type { DocumentSnapshot } from "./version-store";
import type { SingleSheetSnapshot } from "../core/shell-workbook";

export interface SheetDiff {
  /** "row:col" keys of changed cells. */
  changed: Set<string>;
  /** Row indices that contain at least one changed cell. */
  changedRows: Set<number>;
  /** True when nothing changed on this sheet in this revision. */
  noChanges: boolean;
}

type CellData = Record<string, Record<string, { v?: unknown; f?: unknown; s?: unknown } | undefined>>;

function cellDataOf(doc: DocumentSnapshot | null | undefined, sheetId: string): CellData {
  const single = doc?.sheets?.[sheetId] as SingleSheetSnapshot | undefined;
  const ws = single?.sheets?.[sheetId] as { cellData?: CellData } | undefined;
  return ws?.cellData ?? {};
}

/** Diff one sheet between `before` and `after` (value OR formula change = changed). */
export function diffSheet(before: DocumentSnapshot | null | undefined, after: DocumentSnapshot, sheetId: string): SheetDiff {
  const a = cellDataOf(before, sheetId);
  const b = cellDataOf(after, sheetId);
  const changed = new Set<string>();
  const changedRows = new Set<number>();
  const rows = new Set<string>([...Object.keys(a), ...Object.keys(b)]);
  for (const r of rows) {
    const ar = a[r] ?? {};
    const br = b[r] ?? {};
    const cols = new Set<string>([...Object.keys(ar), ...Object.keys(br)]);
    for (const c of cols) {
      const av = ar[c]?.v, bv = br[c]?.v;
      const af = ar[c]?.f, bf = br[c]?.f;
      if (av !== bv || af !== bf) { changed.add(`${r}:${c}`); changedRows.add(Number(r)); }
    }
  }
  return { changed, changedRows, noChanges: changed.size === 0 };
}

// Google-Sheets change highlight (light green).
const HIGHLIGHT_BG = "#d3f0dd";

/**
 * Return a copy of a single-sheet preview snapshot with the changed cells
 * highlighted (green bg merged onto their existing style). Optionally hides rows
 * with no change ("Show unmodified rows" off). The input is not mutated.
 */
export function highlightSnapshot(
  snap: SingleSheetSnapshot,
  sheetId: string,
  changed: Set<string>,
  opts: { highlight?: boolean; hideUnchangedRows?: boolean } = {},
): SingleSheetSnapshot {
  const doHighlight = opts.highlight !== false && changed.size > 0;
  if (!doHighlight && !opts.hideUnchangedRows) return snap;
  const out = JSON.parse(JSON.stringify(snap)) as SingleSheetSnapshot;
  const sheet = out.sheets[sheetId] as { cellData?: CellData; rowData?: Record<string, { hd?: number }> };
  const styles = (out.styles ?? (out.styles = {})) as Record<string, Record<string, unknown>>;
  const cd = sheet.cellData ?? (sheet.cellData = {});

  let seq = 0;
  const freshId = () => { let id: string; do { id = `__hl${seq++}`; } while (styles[id]); return id; };

  if (doHighlight) {
    for (const key of changed) {
      const [r, c] = key.split(":");
      const row = cd[r] ?? (cd[r] = {});
      const cell = row[c] ?? (row[c] = {});
      let base: Record<string, unknown> = {};
      if (typeof cell.s === "string" && styles[cell.s]) base = { ...styles[cell.s] };
      else if (cell.s && typeof cell.s === "object") base = { ...(cell.s as Record<string, unknown>) };
      base.bg = { rgb: HIGHLIGHT_BG };
      const id = freshId();
      styles[id] = base;
      (cell as { s?: unknown }).s = id;
    }
  }

  if (opts.hideUnchangedRows) {
    const changedRows = new Set(Array.from(changed).map((k) => k.split(":")[0]));
    const maxRow = Object.keys(cd).reduce((m, r) => Math.max(m, Number(r)), 0);
    const rowData = sheet.rowData ?? (sheet.rowData = {});
    for (let r = 0; r <= maxRow; r++) {
      if (!changedRows.has(String(r))) rowData[r] = { ...(rowData[r] ?? {}), hd: 1 };
    }
  }
  return out;
}
