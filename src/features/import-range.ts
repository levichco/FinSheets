/**
 * IMPORTRANGE — cross-file linking (Google-Sheets-style).
 *
 * Univer's free (Apache-2.0) formula engine ships every standard function but has
 * NO IMPORTRANGE (that pulls VALUES out of ANOTHER document). We add it as a custom
 * ASYNCHRONOUS formula function via the public Facade
 * (`univerAPI.getFormula().registerAsyncFunction`, which the core preset's
 * auto-loaded `@univerjs/sheets-formula/lib/facade` provides). The engine awaits the
 * returned Promise and spills the resolved matrix into the grid, so
 * `=IMPORTRANGE("<docId>", "Sheet1!A1:C10")` behaves like the real thing.
 *
 * The FinSheets package MUST NOT know how to fetch another document — that's a host
 * concern (auth, workspace, API base URL). So the actual data fetch is an INJECTED
 * resolver the host wires once via `setImportRangeResolver`. The registered function
 * reads the resolver lazily at call time, so registration order vs. injection doesn't
 * matter.
 *
 * VALUES-only (first version): we import the resolved cell VALUES, not live source
 * formulas, and there is no cross-document auth-prompt UI. A source change is picked
 * up on the next recalculation of the importing cell (edit / reopen), not pushed live.
 */
import type { UniverAPI } from "../core/create-sheet";
import type { Disposer } from "../core/facade";

/**
 * Host-injected fetcher: given a source document id and an A1 range (optionally
 * sheet-qualified, e.g. `"Sheet1!A1:C10"` or just `"A1:C10"`), resolve the VALUES
 * matrix (row-major). Return `[]` / `[[]]` when nothing matches. May throw — the
 * function surfaces failures as an in-cell `#REF!`.
 */
export type ImportRangeResolver = (
  sourceId: string,
  rangeA1: string,
) => Promise<(string | number | null)[][]>;

let resolver: ImportRangeResolver | null = null;

/**
 * Inject (or clear, with `null`) the host resolver used by every `IMPORTRANGE`
 * call across every mounted sheet. Call once at editor mount.
 */
export function setImportRangeResolver(fn: ImportRangeResolver | null): void {
  resolver = fn;
}

/** Coerce one incoming formula argument to a plain scalar string.
 *  Args arrive as primitives, a `BaseValueObject` (has `.getValue()`), or a 1×1
 *  matrix when a single cell reference is passed. */
function argToString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    const first = (v as unknown[][])[0]?.[0];
    return first == null ? "" : String(first);
  }
  const obj = v as { getValue?: () => unknown };
  if (typeof obj.getValue === "function") {
    const inner = obj.getValue();
    return inner == null ? "" : String(inner);
  }
  return "";
}

/** A single error cell the engine renders in place (matches Sheets' IMPORTRANGE errors). */
type ResultMatrix = (string | number | null)[][];
const errorCell = (code: string): ResultMatrix => [[code]];

/**
 * Register the async `IMPORTRANGE(sourceId, rangeA1)` custom function on this Univer
 * instance. Returns a disposer that unregisters it. Idempotent per-instance is the
 * caller's concern (call once per `createSheet`).
 */
export function registerImportRange(univerAPI: UniverAPI): Disposer[] {
  // Loose structural view of the formula facade — the exact FFormula type lives behind
  // the preset's side-effect facade import, so we cast to the minimal shape we use.
  const formula = (univerAPI as unknown as {
    getFormula?: () => {
      registerAsyncFunction?: (
        name: string,
        func: (...args: unknown[]) => Promise<ResultMatrix | string | number | null>,
        description?: string,
      ) => Disposer;
    };
  }).getFormula?.();

  if (!formula || typeof formula.registerAsyncFunction !== "function") {
    // Facade surface changed or async registration unavailable — degrade loudly-once
    // rather than silently dropping cross-file links.
    console.warn(
      "[finsheets] IMPORTRANGE not registered: univerAPI.getFormula().registerAsyncFunction is unavailable. Cross-file links will show #NAME?.",
    );
    return [];
  }

  const disposer = formula.registerAsyncFunction(
    "IMPORTRANGE",
    async (...args: unknown[]): Promise<ResultMatrix | string> => {
      const sourceId = argToString(args[0]).trim();
      const rangeA1 = argToString(args[1]).trim();

      if (!sourceId || !rangeA1) return errorCell("#REF!");
      if (!resolver) {
        // No host resolver wired — cross-file linking isn't available in this embed.
        return errorCell("#N/A");
      }

      try {
        const matrix = await resolver(sourceId, rangeA1);
        if (!Array.isArray(matrix) || matrix.length === 0 || !Array.isArray(matrix[0])) {
          return errorCell("#N/A");
        }
        // Normalize ragged rows to a rectangle so the spill is well-formed.
        const width = matrix.reduce((w, row) => Math.max(w, row.length), 0);
        return matrix.map((row) => {
          const out: (string | number | null)[] = new Array(width).fill(null);
          for (let c = 0; c < row.length; c++) out[c] = row[c] ?? null;
          return out;
        });
      } catch (err) {
        console.warn("[finsheets] IMPORTRANGE resolver failed:", err);
        return errorCell("#REF!");
      }
    },
    "Imports a range of cell VALUES from another FinSheets document. Usage: IMPORTRANGE(sourceDocumentId, \"Sheet1!A1:C10\")",
  );

  return disposer ? [disposer] : [];
}
