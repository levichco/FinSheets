/**
 * Column-width memory. On a width-change command, snapshot the current column
 * widths (debounced) and hand them to the consumer's `onColumnWidthsChange` hook
 * so they can persist + restore them on the next load.
 */
import { asFacade, type Disposer } from "../core/facade";
import type { UniverAPI } from "../core/create-sheet";

export interface ColumnWidthsOptions {
  /** Number of table columns to snapshot. */
  columnCount: number;
  onColumnWidthsChange?: (widths: Record<number, number>) => void;
  debounceMs?: number;
}

export function attachColumnWidths(univerAPI: UniverAPI, options: ColumnWidthsOptions): Disposer[] {
  if (!options.onColumnWidthsChange) return [];

  const facade = asFacade(univerAPI);
  const debounceMs = options.debounceMs ?? 400;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const disposers: Disposer[] = [];

  const snapshot = () => {
    const sheet = facade.getActiveWorkbook()?.getActiveSheet();
    if (!sheet) return;
    const widths: Record<number, number> = {};
    for (let c = 0; c < options.columnCount; c++) {
      try {
        const w = sheet.getColumnWidth(c);
        if (typeof w === "number" && w > 0) widths[c] = w;
      } catch {
        /* ignore per-column read errors */
      }
    }
    options.onColumnWidthsChange?.(widths);
  };

  try {
    const eventName = facade.Event?.CommandExecuted;
    if (eventName) {
      disposers.push(
        facade.addEvent(eventName, (event) => {
          if (!event.id || !String(event.id).includes("col-width")) return;
          if (timer) clearTimeout(timer);
          timer = setTimeout(snapshot, debounceMs);
        }),
      );
    }
  } catch {
    /* event surface differs — width persistence is best-effort */
  }

  disposers.push({
    dispose: () => {
      if (timer) clearTimeout(timer);
    },
  });

  return disposers;
}
