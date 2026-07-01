import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { buildExcelWorkbook, type WorkbookSnapshot } from "../../src/core/export-xlsx";

// A snapshot resembling a live Levich sheet after edits: currency formatting,
// a colored bold header, a typed comment, a formula, a merge, custom widths,
// and a frozen header.
const snapshot: WorkbookSnapshot = {
  sheetOrder: ["s1"],
  styles: {
    HEAD: { bl: 1, bg: { rgb: "#F9FAFB" }, cl: { rgb: "#475467" } },
    MONEY: { n: { pattern: '"$"#,##0.00;("$"#,##0.00)' }, ht: 3 },
  },
  sheets: {
    s1: {
      name: "Transactions",
      cellData: {
        0: { 0: { v: "Amount", s: "HEAD" }, 1: { v: "Comment", s: "HEAD" } },
        1: { 0: { v: 1500, s: "MONEY" }, 1: { v: "user typed note" } },
        2: { 0: { f: "=SUM(A2:A2)", v: 1500, s: "MONEY" }, 1: { v: "TOTAL", s: { bl: 1 } } },
        3: { 0: { v: "footer spans two cols" } },
      },
      columnData: { 0: { w: 140 }, 1: { w: 280 } },
      mergeData: [{ startRow: 3, startColumn: 0, endRow: 3, endColumn: 1 }],
      freeze: { xSplit: 0, ySplit: 1 },
    },
  },
};

describe("export fidelity (snapshot → .xlsx → reload)", () => {
  it("preserves edits, number formats, fills, bold, alignment, merges, widths, and freeze", async () => {
    const { workbook, rowCount } = buildExcelWorkbook(snapshot);
    expect(rowCount).toBe(4);

    const buffer = await workbook.xlsx.writeBuffer();
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(buffer as ArrayBuffer);
    const ws = reopened.getWorksheet("Transactions");
    if (!ws) throw new Error("worksheet missing");

    // Edits + values
    expect(ws.getCell("A2").value).toBe(1500);
    expect(ws.getCell("B2").value).toBe("user typed note");

    // Formula + cached result
    const formulaCell = ws.getCell("A3").value as ExcelJS.CellFormulaValue;
    expect(formulaCell.formula).toBe("SUM(A2:A2)");
    expect(formulaCell.result).toBe(1500);

    // Number format (currency) survives
    expect(ws.getCell("A2").numFmt).toContain("$");

    // Header fill + text color + bold survive
    const fill = ws.getCell("A1").fill as ExcelJS.FillPattern;
    expect(fill.fgColor?.argb).toBe("FFF9FAFB");
    expect(ws.getCell("A1").font?.bold).toBe(true);

    // Right alignment on money survives
    expect(ws.getCell("A2").alignment?.horizontal).toBe("right");

    // Column width survives (≈ 280px / 7)
    expect(ws.getColumn(2).width ?? 0).toBeGreaterThan(30);

    // Merge survives
    expect(ws.getCell("A4").isMerged).toBe(true);

    // Frozen header survives
    expect(ws.views?.[0]?.state).toBe("frozen");
    expect((ws.views?.[0] as ExcelJS.WorksheetViewFrozen).ySplit).toBe(1);
  });

  it("returns 0 rows for an empty/not-ready snapshot (no corrupt file)", () => {
    expect(buildExcelWorkbook({}).rowCount).toBe(0);
  });
});
