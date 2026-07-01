/**
 * Loose structural views of Univer's Facade API used by the behavior features.
 * The Facade's event surface varies subtly across engine versions, so the
 * features cast to these minimal shapes and wrap calls defensively (best-effort)
 * — the exact engine pin keeps this stable.
 */
import type { UniverAPI } from "./create-sheet";

export interface Disposer {
  dispose: () => void;
}

export interface FacadeRange {
  getValue(): unknown;
}

export interface FacadeSheet {
  getRange(row: number, column: number): FacadeRange | undefined;
  getColumnWidth(column: number): number;
}

export interface FacadeWorkbook {
  getActiveSheet(): FacadeSheet | undefined;
}

export interface FacadeEventParams {
  row: number;
  column: number;
  cancel?: boolean;
  isConfirm?: boolean;
  id?: string;
}

export interface FacadeLike {
  Event: Record<string, string>;
  addEvent(event: string, callback: (params: FacadeEventParams) => void): Disposer;
  getActiveWorkbook(): FacadeWorkbook | null | undefined;
}

/** Cast the real Facade API to the loose structural shape used by features. */
export function asFacade(univerAPI: UniverAPI): FacadeLike {
  return univerAPI as unknown as FacadeLike;
}
