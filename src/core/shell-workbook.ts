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
 * Only one sheet's styles live in the workbook at a time, so per-sheet style ids
 * (`s1`, `s2`, …) can't collide across sheets. Fidelity is identical to rendering
 * a single-sheet snapshot (the proven path) — merges, images, CF, filters and
 * hyperlinks all come through, because the active sheet IS a real snapshot.
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
}

/**
 * Assemble the combined workbook: all sheets as tabs, the active one hydrated,
 * the rest as shells. Feed the result to `<LevichSheet snapshot={…}>`.
 */
export function buildShellWorkbook(params: BuildShellWorkbookParams): WorkbookData {
  const { documentId, title, manifest, activeSheetId, activeSnapshot } = params;
  const activeData = activeSnapshot.sheets?.[activeSheetId];

  const sheets: Record<string, unknown> = {};
  for (const m of manifest) {
    sheets[m.sheetId] = m.sheetId === activeSheetId && activeData ? activeData : shellSheet(m);
  }

  return {
    id: documentId,
    name: title,
    appVersion: "",
    locale: "enUS",
    sheetOrder: manifest.map((m) => m.sheetId),
    styles: activeSnapshot.styles ?? {},
    sheets,
    // Resources (images, filters, CF, hyperlinks) are keyed by sheetId; only the
    // active sheet's are present, matching the single-sheet snapshot.
    resources: activeSnapshot.resources ?? [],
  };
}
