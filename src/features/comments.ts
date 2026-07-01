/**
 * Editable comment persistence. When a cell in the editable comment column is
 * committed, fire the consumer's `onCellEdit` hook (debounced) with the row key
 * and value. The package mandates no storage backend — the consumer persists.
 */
import { asFacade, type Disposer } from "../core/facade";
import type { UniverAPI } from "../core/create-sheet";
import type { CellEditEvent } from "../core/types";

export interface CommentsOptions {
  /** 0-based index of the editable comment column (-1 = none). */
  editableColumn: number;
  /** Map of sheet row index → stable row key (data rows only). */
  rowKeyByIndex: Map<number, string>;
  onCellEdit?: (event: CellEditEvent) => void;
  debounceMs?: number;
}

export function attachComments(univerAPI: UniverAPI, options: CommentsOptions): Disposer[] {
  if (!options.onCellEdit || options.editableColumn < 0) return [];

  const facade = asFacade(univerAPI);
  const debounceMs = options.debounceMs ?? 600;
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const disposers: Disposer[] = [];

  try {
    const eventName = facade.Event?.SheetEditEnded;
    if (eventName) {
      disposers.push(
        facade.addEvent(eventName, (params) => {
          if (params.column !== options.editableColumn) return;
          if (params.isConfirm === false) return;
          const rowKey = options.rowKeyByIndex.get(params.row);
          if (!rowKey) return;

          const sheet = facade.getActiveWorkbook()?.getActiveSheet();
          const value = sheet?.getRange(params.row, params.column)?.getValue();
          const text = value == null ? "" : String(value);

          const existing = timers.get(rowKey);
          if (existing) clearTimeout(existing);
          timers.set(
            rowKey,
            setTimeout(() => {
              timers.delete(rowKey);
              options.onCellEdit?.({ rowKey, row: params.row, column: params.column, value: text });
            }, debounceMs),
          );
        }),
      );
    }
  } catch {
    /* event surface differs — comment persistence is best-effort */
  }

  disposers.push({
    dispose: () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    },
  });

  return disposers;
}
