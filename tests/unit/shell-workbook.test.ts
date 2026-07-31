import { describe, expect, it } from "vitest";
import { buildShellWorkbook, type SheetManifestEntry, type SingleSheetSnapshot } from "../../src/core/shell-workbook";

const manifest: SheetManifestEntry[] = [
  { order: 0, sheetId: "s1", name: "Sheet1", hidden: 0 },
  { order: 1, sheetId: "s2", name: "Sheet2", hidden: 0 },
];

function sheetWith(id: string, a1: unknown): SingleSheetSnapshot {
  return { sheets: { [id]: { id, name: id, cellData: { 0: { 0: { v: a1 } } } } }, styles: {}, resources: [] };
}

describe("buildShellWorkbook — active sheet sourced from the LIVE cache (edit-preservation)", () => {
  it("prefers hydratedSheets[activeId] over the stale activeSnapshot for the active sheet", () => {
    // activeSnapshot is the LOAD-TIME state (A1 = "old"); the live cache carries the user's
    // edit (A1 = "edited"). A rebuild MUST render the edit, not silently revert to "old".
    const stale = sheetWith("s1", "old");
    const live = sheetWith("s1", "edited");
    const wb = buildShellWorkbook({
      documentId: "doc",
      title: "T",
      manifest,
      activeSheetId: "s1",
      activeSnapshot: stale,
      hydratedSheets: { s1: live },
    });
    const active = wb.sheets.s1 as { cellData: Record<string, Record<string, { v?: unknown }>> };
    expect(active.cellData[0][0].v).toBe("edited");
  });

  it("falls back to activeSnapshot when the active sheet is absent from the cache (initial load)", () => {
    const stale = sheetWith("s1", "load");
    const wb = buildShellWorkbook({
      documentId: "doc",
      title: "T",
      manifest,
      activeSheetId: "s1",
      activeSnapshot: stale,
      hydratedSheets: {}, // nothing captured yet
    });
    const active = wb.sheets.s1 as { cellData: Record<string, Record<string, { v?: unknown }>> };
    expect(active.cellData[0][0].v).toBe("load");
  });
});
