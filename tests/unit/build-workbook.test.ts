import { describe, it, expect } from "vitest";
import { buildWorkbook, resolveFreeze } from "../../src/core/build-workbook";
import type { ColumnDef } from "../../src/core/types";

const columns: ColumnDef[] = [
  { key: "date", header: "Date", format: "date" },
  { key: "amount", header: "Amount", format: "currency", locked: true },
  { key: "note", header: "Note", editable: true },
];

function sheet(wb: ReturnType<typeof buildWorkbook>) {
  const data = wb.workbookData as {
    sheets: Record<string, { cellData: Record<number, Record<number, { v?: unknown; s?: Record<string, unknown> }>>; freeze: unknown; columnData: Record<number, { w: number }> }>;
    sheetOrder: string[];
  };
  return data.sheets[data.sheetOrder[0]];
}

describe("buildWorkbook", () => {
  it("renders a header row from column definitions", () => {
    const wb = buildWorkbook([], columns);
    const s = sheet(wb);
    expect(s.cellData[0][0].v).toBe("Date");
    expect(s.cellData[0][1].v).toBe("Amount");
    expect(s.cellData[0][2].v).toBe("Note");
    expect(wb.rowCount).toBe(0);
  });

  it("renders data rows under the header with per-column formatting", () => {
    const wb = buildWorkbook([{ date: "2026-01-01", amount: 1500, note: "hi" }], columns);
    const s = sheet(wb);
    expect(s.cellData[1][0].v).toBe("2026-01-01");
    expect(s.cellData[1][1].v).toBe(1500);
    // currency column carries a number-format pattern
    expect(JSON.stringify(s.cellData[1][1].s)).toContain("pattern");
    expect(s.cellData[1][2].v).toBe("hi");
  });

  it("keeps currency values numeric (so formulas/export work)", () => {
    const wb = buildWorkbook([{ date: "x", amount: -349621.87, note: "" }], columns);
    const s = sheet(wb);
    expect(typeof s.cellData[1][1].v).toBe("number");
    expect(s.cellData[1][1].v).toBe(-349621.87);
  });

  it("applies comment pre-fill to the editable column by row key", () => {
    const wb = buildWorkbook([{ date: "x", amount: 1, note: "" }], columns, {
      rowKeys: ["r1"],
      commentColumnKey: "note",
      comments: { r1: "seeded note" },
    });
    expect(sheet(wb).cellData[1][2].v).toBe("seeded note");
  });

  it("resolves freeze config", () => {
    expect(resolveFreeze(undefined)).toEqual({ xSplit: 0, ySplit: 1, startRow: 1, startColumn: 0 });
    expect(resolveFreeze(false)).toEqual({ xSplit: 0, ySplit: 0, startRow: 0, startColumn: 0 });
    expect(resolveFreeze({ rows: 2, columns: 1 })).toEqual({ xSplit: 1, ySplit: 2, startRow: 2, startColumn: 1 });
  });

  it("handles empty data without throwing and still has headers", () => {
    const wb = buildWorkbook([], columns, { freeze: { rows: 1 } });
    const s = sheet(wb);
    expect(Object.keys(s.cellData)).toContain("0");
    expect(s.cellData[1]).toBeUndefined();
  });
});
