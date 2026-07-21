/**
 * Univer lifecycle wrapper. Mounts a Univer Sheets instance into a container,
 * loads a workbook snapshot, and returns the instance + Facade API. Disposal is
 * the caller's responsibility (`univer.dispose()`).
 *
 * All `@univerjs/*` imports are isolated to this module (plus the component that
 * imports it) so the heavy engine can be code-split / lazy-loaded by the host.
 *
 * Free-tier only: `UniverSheetsCorePreset` is Apache-2.0; no Pro/exchange.
 */
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import { IRenderManagerService } from "@univerjs/engine-render";
import { CalculationMode } from "@univerjs/sheets-formula";
import UniverPresetSheetsCoreEnUS from "@univerjs/preset-sheets-core/locales/en-US";
import { UniverSheetsFindReplacePreset } from "@univerjs/preset-sheets-find-replace";
import SheetsFindReplaceEnUS from "@univerjs/preset-sheets-find-replace/locales/en-US";
import { UniverSheetsSortPreset } from "@univerjs/preset-sheets-sort";
import SheetsSortEnUS from "@univerjs/preset-sheets-sort/locales/en-US";
import { UniverSheetsFilterPreset } from "@univerjs/preset-sheets-filter";
import SheetsFilterEnUS from "@univerjs/preset-sheets-filter/locales/en-US";
import { UniverSheetsConditionalFormattingPreset } from "@univerjs/preset-sheets-conditional-formatting";
import SheetsCfEnUS from "@univerjs/preset-sheets-conditional-formatting/locales/en-US";
import { UniverSheetsDataValidationPreset } from "@univerjs/preset-sheets-data-validation";
import SheetsDvEnUS from "@univerjs/preset-sheets-data-validation/locales/en-US";
import { UniverSheetsNotePreset } from "@univerjs/preset-sheets-note";
import SheetsNoteEnUS from "@univerjs/preset-sheets-note/locales/en-US";
import { UniverSheetsHyperLinkPreset } from "@univerjs/preset-sheets-hyper-link";
import SheetsHyperLinkEnUS from "@univerjs/preset-sheets-hyper-link/locales/en-US";
import { UniverSheetsTablePreset } from "@univerjs/preset-sheets-table";
import SheetsTableEnUS from "@univerjs/preset-sheets-table/locales/en-US";
import { UniverSheetsDrawingPreset } from "@univerjs/preset-sheets-drawing";
import SheetsDrawingEnUS from "@univerjs/preset-sheets-drawing/locales/en-US";
import { LocaleType, createUniver, mergeLocales, type Theme } from "@univerjs/presets";
import "@univerjs/preset-sheets-core/lib/index.css";
import "@univerjs/preset-sheets-find-replace/lib/index.css";
import "@univerjs/preset-sheets-sort/lib/index.css";
import "@univerjs/preset-sheets-filter/lib/index.css";
import "@univerjs/preset-sheets-conditional-formatting/lib/index.css";
import "@univerjs/preset-sheets-data-validation/lib/index.css";
import "@univerjs/preset-sheets-note/lib/index.css";
import "@univerjs/preset-sheets-hyper-link/lib/index.css";
import "@univerjs/preset-sheets-table/lib/index.css";
import "@univerjs/preset-sheets-drawing/lib/index.css";
import "../theme/office-fonts.css"; // alias Calibri→Carlito etc. (Excel-accurate fonts)
import "../theme/levich-theme.css";
import { brandContainer } from "../theme/branding-plugin";
import { levichTheme } from "../theme/levich-theme";
import { deepMergeLocales, levichLocale } from "../theme/locales";
import type { WorkbookData } from "./types";

export type UniverAPI = ReturnType<typeof createUniver>["univerAPI"];

/** Univer ribbon styles: "simple" = ungrouped single toolbar (Levich default). */
export type RibbonType = "collapsed" | "simple" | "classic";

export interface CreateSheetOptions {
  container: HTMLElement;
  workbookData: WorkbookData;
  /** Univer ribbon style. Defaults to "simple" (compact single toolbar). */
  ribbonType?: RibbonType;
  /**
   * Show Univer's toolbar / operations bar (font, bold, alignment, number
   * format, etc.). Defaults to `true`. With `ribbonType:"simple"` this is just
   * the compact toolbar — no File/Edit menu (that is the "classic" ribbon).
   */
  header?: boolean;
  /** Show the bottom sheet-tab footer. Defaults to `true`. */
  footer?: boolean;
  /**
   * Show Univer's built-in toolbar buttons. Defaults to `true`. Set `false`
   * when rendering the custom Levich toolbar (the formula bar still shows).
   */
  univerToolbar?: boolean;
  /** Theme tokens applied to the engine. Defaults to the Levich theme. */
  theme?: Theme;
}

export interface CreatedSheet {
  univer: ReturnType<typeof createUniver>["univer"];
  univerAPI: UniverAPI;
}

export function createSheet({
  container,
  workbookData,
  ribbonType = "simple",
  header = true,
  footer = true,
  univerToolbar = true,
  theme,
}: CreateSheetOptions): CreatedSheet {
  brandContainer(container);

  // header:true + ribbonType:"simple" → the compact operations toolbar (font,
  // bold, alignment, number format, …) + formula bar, with NO File/Edit menu /
  // doc-title / Share (those belong to the "classic" ribbon). The host renders
  // its own brand chrome above.
  const presetConfig: Parameters<typeof UniverSheetsCorePreset>[0] = {
    container,
    ribbonType,
    header,
    toolbar: univerToolbar,
    contextMenu: true,
    // Our date/id columns are intentionally text — suppress Univer's
    // "number stored as text" green-triangle marks + alert popup.
    sheets: { disableForceStringAlert: true, disableForceStringMark: true },
    // WHEN_EMPTY (Univer's default): compute ONLY formula cells that have no cached
    // value; leave cells that already carry a cached value untouched. This preserves
    // the numbers Excel/Google Sheets baked in (a FORCED full recalc would turn
    // unsupported functions and self-#REF! into #NAME?/#VALUE!, clobbering them) while
    // still filling in totals for uploaded/exported sheets whose formula cells have NO
    // cached value — NO_CALCULATION left those permanently blank (e.g. a SUM row shows
    // nothing, and a dependent cell that reads it computes a WRONG result treating the
    // blank as 0). WHEN_EMPTY computes those empties on load so totals render correctly.
    // Editing still recomputes dependents at runtime.
    formula: { initialFormulaComputing: CalculationMode.WHEN_EMPTY },
  };
  if (footer === false) presetConfig.footer = false; // omit → Univer default (shown)

  const { univer, univerAPI } = createUniver({
    locale: LocaleType.EN_US,
    locales: {
      // Base = all preset locales (shallow-merged). Levich overrides are then
      // DEEP-merged on top so partial sub-objects (e.g. only some
      // `sheets-filter-ui.panel` keys) don't wipe out sibling keys.
      [LocaleType.EN_US]: mergeLocales(
        deepMergeLocales(
          mergeLocales(
            UniverPresetSheetsCoreEnUS,
            SheetsFindReplaceEnUS,
            SheetsSortEnUS,
            SheetsFilterEnUS,
            SheetsCfEnUS,
            SheetsDvEnUS,
            SheetsNoteEnUS,
            SheetsHyperLinkEnUS,
            SheetsTableEnUS,
            SheetsDrawingEnUS,
          ) as Record<string, unknown>,
          levichLocale,
        ) as Parameters<typeof mergeLocales>[0],
      ),
    },
    theme: theme ?? levichTheme,
    // Core + free-tier add-on presets (Apache-2.0): find & replace, sort,
    // filter, conditional formatting, data validation, notes, hyperlinks,
    // tables. No Pro (charts, pivot, collaboration, exchange).
    presets: [
      UniverSheetsCorePreset(presetConfig),
      UniverSheetsFindReplacePreset(),
      UniverSheetsSortPreset(),
      UniverSheetsFilterPreset(),
      UniverSheetsConditionalFormattingPreset(),
      UniverSheetsDataValidationPreset(),
      UniverSheetsNotePreset(),
      UniverSheetsHyperLinkPreset(),
      UniverSheetsTablePreset(),
      UniverSheetsDrawingPreset(),
    ],
  });
  univerAPI.createWorkbook(workbookData);
  return { univer, univerAPI };
}

/**
 * Force Univer to re-measure its canvas against the container's CURRENT size, right now.
 *
 * Univer's engine sizes its canvas from the container box at `setContainer()` time and
 * afterwards recovers via its own `ResizeObserver` — but that observer defers the actual
 * `engine.resize()` through `requestIdleCallback`. In a busy app the idle callback can be
 * starved indefinitely, so when the grid is built while its container is momentarily 0×0
 * (mounted in a still-hidden / not-yet-laid-out subtree during a route/overlay/tab
 * transition, or a late flex height) the canvas stays stuck at 0×0 = a blank grid, even
 * after the container settles to its real size.
 *
 * Calling `engine.resize()` directly bypasses that starved idle callback: it re-reads the
 * container box and, if the size differs from what the engine last saw (e.g. 0×0 → N×M),
 * resizes the canvas and repaints. It early-returns when the size is unchanged, so calling
 * it repeatedly / on every observed resize is cheap and safe.
 */
let warnedNoEngine = false;
export function forceCanvasResize(univerAPI: UniverAPI): void {
  try {
    const api = univerAPI as unknown as { _injector?: { get: (t: unknown) => unknown } };
    const unitId = univerAPI.getActiveWorkbook?.()?.getId?.();
    if (!api._injector || !unitId) return; // no workbook yet — legitimate, stay quiet
    const rms = api._injector.get(IRenderManagerService) as
      | { getRenderById?: (id: string) => { engine?: { resize?: () => void } } | undefined }
      | undefined;
    const engine = rms?.getRenderById?.(unitId)?.engine;
    if (typeof engine?.resize !== "function") {
      // We had a workbook + injector but couldn't reach the render engine: a Univer
      // internals rename would otherwise degrade SILENTLY to a permanently blank
      // canvas. Warn once so the regression is visible instead of a mystery blank.
      if (!warnedNoEngine) {
        warnedNoEngine = true;
        console.warn("[finsheets] forceCanvasResize: could not reach Univer's render engine.resize — the grid may not recover from a 0×0 mount. Univer's internal API may have changed.");
      }
      return;
    }
    engine.resize();
  } catch {
    /* best-effort: never let a resize nudge throw into the caller */
  }
}
