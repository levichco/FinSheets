/**
 * Read-only (locked) columns. Vetoes edits that land on a locked data cell or
 * the footer/totals row by cancelling the `BeforeSheetEditEnd` event. Free-tier
 * friendly — no paid range protection (constitution Principle II).
 */
import { asFacade, type Disposer } from "../core/facade";
import type { UniverAPI } from "../core/create-sheet";

export interface LockColumnsOptions {
  /** 0-based indices of locked columns. */
  lockedColumns: number[];
  /** Number of data rows (rows 1..rowCount are the data block). */
  rowCount: number;
  /** Optional footer/totals row index (also locked). */
  footerRowIndex?: number;
}

export function attachLockColumns(univerAPI: UniverAPI, options: LockColumnsOptions): Disposer[] {
  const locked = new Set(options.lockedColumns);
  if (locked.size === 0 && options.footerRowIndex === undefined) return [];

  const facade = asFacade(univerAPI);
  const disposers: Disposer[] = [];

  const isLocked = (row: number, column: number): boolean => {
    const isDataCell = row >= 1 && row <= options.rowCount && locked.has(column);
    const isFooterCell = options.footerRowIndex !== undefined && row === options.footerRowIndex;
    return isDataCell || isFooterCell;
  };

  try {
    // Veto at edit START so the editor never opens on a locked cell. This keeps
    // locked columns truly read-only AND avoids leaving the editor "open" (which
    // kept the internal edit-state flag stuck and could swallow a formatting op
    // applied right after — e.g. borders/alignment on a locked cell). Formatting
    // (borders, fills, alignment, …) is NOT an edit, so it stays allowed
    // everywhere — including locked columns.
    const startEvent = facade.Event?.BeforeSheetEditStart;
    if (startEvent) {
      disposers.push(
        facade.addEvent(startEvent, (params) => {
          if (isLocked(params.row, params.column)) params.cancel = true;
        }),
      );
    }
    // Keep the edit-END veto as a belt-and-suspenders guard (paste/fill paths).
    const endEvent = facade.Event?.BeforeSheetEditEnd;
    if (endEvent) {
      disposers.push(
        facade.addEvent(endEvent, (params) => {
          if (isLocked(params.row, params.column)) params.cancel = true;
        }),
      );
    }
  } catch {
    /* event surface differs — locking is best-effort */
  }

  return disposers;
}
