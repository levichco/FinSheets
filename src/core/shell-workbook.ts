/**
 * Shell-workbook assembly — the heart of the lazy multi-sheet product.
 *
 * A large workbook (dozens of sheets, MBs of cells) can't be handed to Univer all
 * at once — it froze the tab at ~5 MB. But native footer tabs, rename, duplicate,
 * colour, hide and move all require Univer to KNOW about every sheet.
 *
 * The resolution: build ONE workbook where every sheet appears in `sheetOrder`
 * (so all tabs render) but only the ACTIVE sheet carries cellData/styles/
 * resources. Every other sheet is a lightweight **shell** — id, name, dimensions,
 * tab colour, hidden flag, empty `cellData`. Switching tabs re-hydrates: the host
 * fetches the newly-active sheet's snapshot and rebuilds the shell workbook with
 * that sheet full and the previous one back to a shell.
 *
 * Cross-sheet formulas (`=Sheet2!A1`, `=SUM('Details'!A1:A10)`) need the REFERENCED
 * sheet's data to be resident — an empty shell resolves the reference against nothing
 * and returns 0/#REF!. So any sheet the host has ALREADY fetched (its per-sheet cache)
 * is passed in via `hydratedSheets` and merged in with real `cellData`; only sheets
 * whose data isn't loaded yet stay shells (they fill in as the host's background
 * hydration loop warms the cache). Univer still only RENDERS the active sheet's canvas,
 * so resident-but-not-rendered data costs no more than any spreadsheet keeps in memory.
 *
 * Per-sheet style ids (`"1"`, `"2"`, …) are LOCAL to each single-sheet snapshot and
 * therefore COLLIDE across sheets once several are resident. Every non-active sheet's
 * style ids are namespaced `"<sheetId>::<styleId>"` and its cells' `s` references are
 * remapped to match before its styles are folded into the workbook `styles` table. The
 * active sheet keeps its ORIGINAL (unprefixed) ids so its snapshot round-trips verbatim
 * on save; an active id like `"1"` can never equal a namespaced `"<sheetId>::1"`, so the
 * two id spaces are disjoint. Fidelity is identical to rendering a single-sheet snapshot
 * (the proven path) — merges, images, CF, filters and hyperlinks come through for the
 * active sheet (its resources are the workbook's), and resident sheets contribute values
 * + styling for reference resolution.
 */
import type { WorkbookData } from "./types";

/** One row of the document manifest — enough to draw a tab without its data. */
export interface SheetManifestEntry {
  order: number;
  sheetId: string;
  name: string;
  /** 1 = hidden (no tab). */
  hidden: number;
  /** Tab colour (#RRGGBB) so shells match before hydration. */
  tabColor?: string;
  rowCount?: number;
  columnCount?: number;
}

/** A single-sheet snapshot as produced by `singleSheetSnapshot` / the BE. */
export interface SingleSheetSnapshot {
  sheets: Record<string, Record<string, unknown>>;
  styles?: Record<string, unknown>;
  resources?: Array<{ name: string; data: string }>;
  [k: string]: unknown;
}

const SHELL_ROWS = 200;
const SHELL_COLS = 26;
const DEFAULT_ROW_HEIGHT = 24;
const DEFAULT_COL_WIDTH = 88;

/** A minimal but valid IWorksheetData for a not-yet-loaded sheet. */
function shellSheet(m: SheetManifestEntry): Record<string, unknown> {
  return {
    id: m.sheetId,
    name: m.name,
    rowCount: m.rowCount ?? SHELL_ROWS,
    columnCount: m.columnCount ?? SHELL_COLS,
    cellData: {},
    defaultRowHeight: DEFAULT_ROW_HEIGHT,
    defaultColumnWidth: DEFAULT_COL_WIDTH,
    ...(m.tabColor ? { tabColor: m.tabColor } : {}),
    ...(m.hidden ? { hidden: 1 } : {}),
  };
}

export interface BuildShellWorkbookParams {
  documentId: string;
  title: string;
  /** Every sheet in the document, in tab order. */
  manifest: SheetManifestEntry[];
  /** The currently-active sheet id (the one hydrated with real data). */
  activeSheetId: string;
  /** The active sheet's single-sheet snapshot (its data + styles + resources). */
  activeSnapshot: SingleSheetSnapshot;
  /**
   * Other already-fetched sheets (the host's per-sheet cache), keyed by sheetId.
   * Each becomes RESIDENT — its real `cellData` is merged in (with namespaced style
   * ids) so cross-sheet formula references resolve against real values instead of an
   * empty shell. The active sheet is always taken from `activeSnapshot` even if it also
   * appears here. Sheets absent from this map stay lightweight shells until the host's
   * background loop hydrates them; a formula referencing a not-yet-resident sheet stays
   * on its cached value (NO_CALCULATION) and resolves once the cache warms + rebuilds.
   */
  hydratedSheets?: Record<string, SingleSheetSnapshot>;
}

/** Separator for namespaced per-sheet style ids: `"<sheetId>::<styleId>"`. */
const STYLE_NS = "::";

/** The worksheet object out of a single-sheet snapshot (keyed by id, else the sole entry). */
function sheetDataOf(snap: SingleSheetSnapshot, sheetId: string): Record<string, unknown> | undefined {
  const direct = snap.sheets?.[sheetId];
  if (direct) return direct;
  const vals = snap.sheets ? Object.values(snap.sheets) : [];
  return vals.length ? (vals[0] as Record<string, unknown>) : undefined;
}

/**
 * Prepare a NON-active resident sheet for merging: namespace its style ids under
 * `"<sheetId>::"` and remap every cell's STRING `s` reference to the prefixed id, so
 * per-sheet ids can't collide with another sheet's. The source snapshot is never mutated
 * (the host reuses it verbatim on save) — new cell/row objects are created only where an
 * `s` string is rewritten; inline-object styles and cells without `s` pass through by
 * reference. Returns the remapped worksheet data + the prefixed styles to fold into the
 * workbook `styles` table.
 */
function namespaceSheetStyles(
  sheetId: string,
  sheetData: Record<string, unknown>,
  styles: Record<string, unknown> | undefined,
): { data: Record<string, unknown>; styles: Record<string, unknown> } {
  const prefixed: Record<string, unknown> = {};
  if (styles) {
    for (const [sid, style] of Object.entries(styles)) prefixed[`${sheetId}${STYLE_NS}${sid}`] = style;
  }
  const srcCellData = sheetData.cellData as Record<string, Record<string, { s?: unknown }>> | undefined;
  if (!srcCellData) return { data: sheetData, styles: prefixed };
  const remapped: Record<string, Record<string, unknown>> = {};
  for (const [row, cols] of Object.entries(srcCellData)) {
    const newRow: Record<string, unknown> = {};
    for (const [col, cell] of Object.entries(cols)) {
      newRow[col] = cell && typeof cell.s === "string" ? { ...cell, s: `${sheetId}${STYLE_NS}${cell.s}` } : cell;
    }
    remapped[row] = newRow;
  }
  return { data: { ...sheetData, cellData: remapped }, styles: prefixed };
}

/**
 * Assemble the combined workbook: all sheets as tabs; the active sheet + every
 * `hydratedSheets` entry carry real data (so cross-sheet refs resolve), the rest are
 * shells. Feed the result to `<LevichSheet snapshot={…}>`.
 */
export function buildShellWorkbook(params: BuildShellWorkbookParams): WorkbookData {
  const { documentId, title, manifest, activeSheetId, activeSnapshot, hydratedSheets } = params;
  const activeData = activeSnapshot.sheets?.[activeSheetId] ?? sheetDataOf(activeSnapshot, activeSheetId);

  // Active sheet keeps its ORIGINAL style ids (round-trips verbatim on save); every other
  // resident sheet is namespaced so per-sheet ids can't collide once many are resident.
  const styles: Record<string, unknown> = { ...(activeSnapshot.styles ?? {}) };
  const sheets: Record<string, unknown> = {};
  for (const m of manifest) {
    const id = m.sheetId;
    if (id === activeSheetId && activeData) {
      sheets[id] = activeData;
      continue;
    }
    const snap = hydratedSheets?.[id];
    const data = snap ? sheetDataOf(snap, id) : undefined;
    if (snap && data) {
      const merged = namespaceSheetStyles(id, data, snap.styles);
      sheets[id] = merged.data;
      Object.assign(styles, merged.styles);
    } else {
      sheets[id] = shellSheet(m);
    }
  }

  return {
    id: documentId,
    name: title,
    appVersion: "",
    locale: "enUS",
    sheetOrder: manifest.map((m) => m.sheetId),
    styles,
    sheets,
    // Resources (images, filters, CF, hyperlinks) are keyed by sheetId; only the
    // active sheet's are present, matching the single-sheet snapshot.
    resources: activeSnapshot.resources ?? [],
  };
}
