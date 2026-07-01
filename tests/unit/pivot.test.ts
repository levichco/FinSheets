import { describe, it, expect } from "vitest";
import { computePivot, buildPivotCells } from "../../src/features/pivot";
import type { SheetData } from "../../src/core/types";

const data: SheetData = [
  { type: "Invoice", entity: "A", amount: 100 },
  { type: "Invoice", entity: "B", amount: 200 },
  { type: "Payment", entity: "A", amount: 50 },
  { type: "Payment", entity: "A", amount: 25 },
  { type: "Invoice", entity: "A", amount: 300 },
];

describe("computePivot", () => {
  it("sums values by row group × column group with subtotals and grand total", () => {
    const result = computePivot(data, { rows: ["type"], columns: ["entity"], values: ["amount"], aggregate: "sum" });

    expect(result.rowKeys).toEqual(["Invoice", "Payment"]);
    expect(result.colKeys).toEqual(["A", "B"]);

    // Invoice/A = 100 + 300 = 400; Invoice/B = 200
    expect(result.cells["Invoice"]["A"]).toBe(400);
    expect(result.cells["Invoice"]["B"]).toBe(200);
    // Payment/A = 50 + 25 = 75; Payment/B = 0 (no records)
    expect(result.cells["Payment"]["A"]).toBe(75);
    expect(result.cells["Payment"]["B"]).toBe(0);

    // Subtotals
    expect(result.rowTotals["Invoice"]).toBe(600);
    expect(result.rowTotals["Payment"]).toBe(75);
    expect(result.colTotals["A"]).toBe(475);
    expect(result.colTotals["B"]).toBe(200);

    // Grand total
    expect(result.grandTotal).toBe(675);
  });

  it("supports count and average aggregations", () => {
    const count = computePivot(data, { rows: ["type"], columns: [], values: ["amount"], aggregate: "count" });
    expect(count.rowTotals["Invoice"]).toBe(3);
    expect(count.rowTotals["Payment"]).toBe(2);
    expect(count.grandTotal).toBe(5);

    const avg = computePivot(data, { rows: ["type"], columns: [], values: ["amount"], aggregate: "average" });
    expect(avg.rowTotals["Invoice"]).toBe(200); // (100+200+300)/3
    expect(avg.rowTotals["Payment"]).toBe(37.5); // (50+25)/2
  });

  it("renders a pivot cell region with header, rows, and a grand-total row", () => {
    const result = computePivot(data, { rows: ["type"], columns: ["entity"], values: ["amount"], aggregate: "sum" });
    const region = buildPivotCells(result);

    // header: "", A, B, Total
    expect(region.cells[0][1]?.v).toBe("A");
    expect(region.cells[0][2]?.v).toBe("B");
    expect(region.cells[0][3]?.v).toBe("Total");
    // first row group
    expect(region.cells[1][0]?.v).toBe("Invoice");
    expect(region.cells[1][3]?.v).toBe(600); // row total
    // grand-total row
    const gr = result.rowKeys.length + 1;
    expect(region.cells[gr][0]?.v).toBe("Grand Total");
    expect(region.cells[gr][3]?.v).toBe(675);
    expect(region.columnCount).toBe(4);
  });
});
