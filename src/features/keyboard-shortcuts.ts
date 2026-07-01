/**
 * Cross-platform keyboard shortcuts (Mac ⌘ + Windows/Linux Ctrl).
 *
 * We ONLY bind shortcuts Univer doesn't already handle natively (Univer core
 * already does Bold/Italic/Underline, Undo/Redo, Cut/Copy/Paste, Select-all,
 * arrow navigation, F2, hyperlink ⌘K, …). Binding those again would double-fire.
 * These are the gaps tied to our own menus/toolbar + the browser-reserved keys
 * we must intercept (⌘F/S/O/P). Matching uses `event.code` (physical key), so
 * it's keyboard-layout independent, and the accelerator is `metaKey || ctrlKey`
 * so the same table works on macOS and Windows.
 *
 * Shortcut choices follow the researched Excel/Google-Sheets mapping (Sheets-
 * first). NOTE: ⌘⇧R (align-right in Sheets) is intentionally NOT bound — it
 * collides with the browser's hard-reload; use the toolbar for align-right.
 */
import { insertAggregate, type FunctionsApi } from "./functions";
import { printSheet } from "../core/print-sheet";

/* ---- Loose Facade views --------------------------------------------------- */
interface KRange {
  setNumberFormat(p: string): unknown;
  setHorizontalAlignment(a: string): unknown;
  setValue(v: unknown): unknown;
}
interface KSheet {
  getSheetId?: () => string;
  getSheetName?: () => string;
}
interface KWorkbook {
  getActiveRange?: () => KRange | null;
  getActiveSheet?: () => KSheet | null;
  getSheets?: () => KSheet[];
  setActiveSheet?: (s: KSheet | string) => unknown;
  create?: (name: string, rows: number, cols: number) => unknown;
}
interface KApi {
  getActiveWorkbook?: () => KWorkbook | null;
  executeCommand?: (id: string, params?: object) => unknown;
}

export interface ShortcutContext {
  api: unknown;
  /** Open the Find & Replace modal. */
  onFind?: () => void;
  /** Trigger File ▸ Import (file picker + location modal). */
  onImport?: () => void;
  /** Trigger printing (defaults to printing the active workbook). */
  onPrint?: () => void;
  /** Optional host save hook (⌘S). We always suppress the browser save dialog. */
  onSave?: () => void;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Attach the global shortcut handler. `getCtx` is called on every keystroke so
 * the handler always sees the latest api/callbacks (avoids stale closures).
 * Returns a disposer.
 */
export function attachKeyboardShortcuts(getCtx: () => ShortcutContext): () => void {
  const onKey = (e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey; // ⌘ on macOS, Ctrl on Windows/Linux
    const shift = e.shiftKey;
    const alt = e.altKey;
    const code = e.code;
    if (!mod && !alt && !(shift && code === "F11")) return; // fast bail on plain typing

    const ctx = getCtx();
    const api = ctx.api as KApi | null;
    const wb = () => api?.getActiveWorkbook?.() ?? null;
    const range = () => wb()?.getActiveRange?.() ?? null;
    const take = () => {
      e.preventDefault();
      e.stopImmediatePropagation(); // win over the browser + Univer's own handlers
    };
    const numFmt = (p: string) => {
      take();
      try {
        range()?.setNumberFormat(p);
      } catch {
        /* ignore */
      }
    };
    const align = (a: string) => {
      take();
      try {
        range()?.setHorizontalAlignment(a);
      } catch {
        /* ignore */
      }
    };
    const moveSheet = (dir: number) => {
      take();
      try {
        const w = wb();
        const sheets = w?.getSheets?.() ?? [];
        const activeId = w?.getActiveSheet?.()?.getSheetId?.();
        const idx = sheets.findIndex((s) => s.getSheetId?.() === activeId);
        const next = sheets[idx + dir];
        if (next) w?.setActiveSheet?.(next);
      } catch {
        /* ignore */
      }
    };

    // ---- Browser-reserved / custom-UI (accelerator = ⌘/Ctrl) ---------------
    if (mod && !alt) {
      if (code === "KeyF" && !shift) { take(); ctx.onFind?.(); return; }        // Find
      if (code === "KeyH" && shift) { take(); ctx.onFind?.(); return; }         // Find & Replace
      if (code === "KeyO" && !shift) { take(); ctx.onImport?.(); return; }      // Open / Import
      if (code === "KeyP" && !shift) { take(); (ctx.onPrint ?? (() => printSheet(wb() as never)))(); return; } // Print
      if (code === "KeyS" && !shift) { take(); ctx.onSave?.(); return; }        // Save (suppress browser dialog)
      if (code === "Backslash" && !shift) { take(); try { api?.executeCommand?.("sheet.command.clear-selection-format"); } catch { /* */ } return; } // Clear formatting

      // Number formats (Sheets: Ctrl+Shift+digit) — also accept ⌘ on Mac.
      if (shift) {
        switch (code) {
          case "Digit1": return numFmt("#,##0.00");            // Number
          case "Digit2": return numFmt("h:mm:ss am/pm");       // Time
          case "Digit3": return numFmt("yyyy-mm-dd");          // Date
          case "Digit4": return numFmt('"$"#,##0.00');         // Currency
          case "Digit5": return numFmt("0.00%");               // Percent
          case "KeyL": return align("left");
          case "KeyE": return align("center");
          // KeyR (align right) intentionally unbound — collides with hard-reload.
        }
      }

      // Insert current date / time.
      if (code === "Semicolon") {
        take();
        try {
          const d = new Date();
          const v = shift
            ? `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
            : `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
          range()?.setValue(v);
        } catch {
          /* ignore */
        }
        return;
      }
    }

    // ---- Alt-based -----------------------------------------------------------
    if (alt && !mod) {
      if (code === "Equal") { take(); try { insertAggregate(api as unknown as FunctionsApi, "SUM"); } catch { /* */ } return; } // AutoSum
      if (code === "ArrowDown") { return moveSheet(1); }   // next sheet
      if (code === "ArrowUp") { return moveSheet(-1); }    // previous sheet
    }

    // ---- New sheet (Shift+F11) ----------------------------------------------
    if (shift && !mod && !alt && code === "F11") {
      take();
      try {
        const w = wb();
        const existing = new Set((w?.getSheets?.() ?? []).map((s) => s.getSheetName?.() ?? ""));
        // Lowest unused "SheetN" (Google-style), not existing.size+1 which can
        // skip a freed-up number.
        let i = 1;
        while (existing.has(`Sheet${i}`)) i++;
        w?.create?.(`Sheet${i}`, 100, 26);
      } catch {
        /* ignore */
      }
      return;
    }
  };

  window.addEventListener("keydown", onKey, true); // capture phase
  return () => window.removeEventListener("keydown", onKey, true);
}
