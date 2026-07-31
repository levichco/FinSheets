// Pure, React-free scans over a raw Univer `IWorkbookData` snapshot. Kept separate
// from LevichSheet so the open-at-# (feature #2) and empty-formula (feature #12
// companion to NO_CALCULATION) logic can be unit-tested without a DOM/engine.

type SnapCell = { v?: unknown; f?: unknown };
type SnapSheet = { cellData?: Record<string, Record<string, SnapCell>> };
type Snap = { sheetOrder?: string[]; sheets?: Record<string, SnapSheet> };

/**
 * The active sheet's cellData grid from a raw Univer snapshot (best-effort).
 *
 * Pass `activeSheetId` to target a SPECIFIC sheet — required under the shell-workbook
 * model now that MULTIPLE sheets are resident (their data merged in for cross-sheet
 * refs). The post-load recompute writes into `getActiveSheet()`, so it must scan the
 * active sheet's grid, not just "the first sheet that has data" (which is `sheetOrder[0]`,
 * often NOT the active tab). Without an id — e.g. a plain full-workbook xlsx-import
 * snapshot whose active sheet is index 0 — it falls back to the first populated sheet.
 */
export function activeCellData(snapshot: unknown, activeSheetId?: string): Record<string, Record<string, SnapCell>> | undefined {
  const s = snapshot as Snap | undefined;
  const order = s?.sheetOrder;
  if (!order?.length) return undefined;
  // Explicit active sheet id wins (multi-sheet resident workbook): scan exactly that grid.
  if (activeSheetId) {
    const cd = s?.sheets?.[activeSheetId]?.cellData;
    if (cd) return cd;
  }
  // No id (or the id wasn't in the snapshot): return the first sheet that actually has
  // cell data (the hydrated/active one for the old single-resident model). Falls back to
  // sheetOrder[0] for a fully-populated snapshot.
  for (const id of order) {
    const cd = s?.sheets?.[id]?.cellData;
    if (cd && Object.keys(cd).length > 0) return cd;
  }
  return s?.sheets?.[order[0]]?.cellData;
}

/** Matches Excel error tokens (`#REF!`, `#NAME?`, …) so the "#" anchor scan skips them. */
export const EXCEL_ERROR = /^#(REF|NAME|VALUE|DIV\/0|N\/A|NULL|NUM|SPILL|CALC|GETTING_DATA)!?/i;

/**
 * Feature #2 — find the first deliberate "#" anchor cell: a cell whose text value
 * starts with `#` but is NOT an Excel error token. Scans the in-memory snapshot
 * (cheap) rather than probing the grid via the Facade.
 */
export function findHashCell(snapshot: unknown, activeSheetId?: string): { row: number; column: number } | null {
  const cellData = activeCellData(snapshot, activeSheetId);
  if (!cellData) return null;
  for (const [r, cols] of Object.entries(cellData)) {
    for (const [c, cell] of Object.entries(cols)) {
      const v = cell?.v;
      if (typeof v === "string") {
        const t = v.trim();
        // A deliberate review marker: "#" alone, or "#" followed by a space/letter
        // (e.g. "#review", "# note"). Excludes coded IDs like "#123"/"#4A" and Excel
        // error tokens (#REF!/#NAME? — caught by EXCEL_ERROR), which shouldn't be anchors.
        if (/^#($|\s|[a-zA-Z])/.test(t) && !EXCEL_ERROR.test(t)) return { row: Number(r), column: Number(c) };
      }
    }
  }
  return null;
}

/**
 * Feature #12 (companion to NO_CALCULATION) — formula cells that carry NO cached value
 * (Excel never computed them, e.g. a freshly exported sheet whose `=SUM` totals are
 * blank). Under NO_CALCULATION these would render empty, so we recompute ONLY these
 * post-load by re-setting their formula — never the cells that already have a cached
 * value (those are preserved verbatim, which is what keeps genuine zero totals intact).
 */
export function emptyFormulaCells(snapshot: unknown, activeSheetId?: string): Array<{ row: number; column: number; formula: string }> {
  const cellData = activeCellData(snapshot, activeSheetId);
  if (!cellData) return [];
  const out: Array<{ row: number; column: number; formula: string }> = [];
  for (const [r, cols] of Object.entries(cellData)) {
    for (const [c, cell] of Object.entries(cols)) {
      const f = cell && typeof cell.f === "string" ? cell.f : "";
      const hasFormula = f.length > 0;
      const noCachedValue = cell?.v === undefined || cell?.v === null || cell?.v === "";
      // Do NOT recompute a cross-sheet formula on load — even now that referenced sheets
      // can be RESIDENT (their cellData merged into the shell workbook). Order matters:
      // residency is filled in lazily by the host's background hydration loop, so at any
      // given load a `='P&L'!B12` / `=SUM(Detail!A:A)` may reference a sheet NOT YET
      // hydrated (still an empty shell). Recomputing it then resolves against nothing and
      // renders #NAME?/#REF! (the "formula broken" regression). NO_CALCULATION already
      // preserves the cell's cached value verbatim, and any genuinely-empty cross-sheet
      // formula recomputes correctly on the next edit/recalc once the target is resident —
      // so keeping this guard is strictly safe. A "!" marks a sheet-qualified reference, but
      // ONLY outside a string literal: a same-sheet formula can legitimately contain "!"
      // inside a double-quoted string (=IF(A1>0,"Done!","")), which must NOT be mistaken for
      // a cross-sheet ref (that would wrongly skip its recompute and leave it blank on load).
      // Strip double-quoted literals first; sheet names are bare or single-quoted, so this
      // never hides a real cross-sheet reference.
      const referencesOtherSheet = f.replace(/"(?:[^"]|"")*"/g, "").includes("!");
      if (hasFormula && noCachedValue && !referencesOtherSheet) out.push({ row: Number(r), column: Number(c), formula: f });
    }
  }
  return out;
}
