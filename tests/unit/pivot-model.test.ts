import { describe, expect, it } from "vitest";
import { computePivotModel, renderPivotModel } from "../../src/features/pivot-model";
import type { PivotSource, PivotSpec } from "../../src/core/types";

const source: PivotSource = {
  fields: ["region", "product", "amount"],
  rows: [
    { region: "West", product: "A", amount: 100 },
    { region: "West", product: "A", amount: 50 },
    { region: "West", product: "B", amount: 30 },
    { region: "East", product: "A", amount: 200 },
    { region: "East", product: "B", amount: 20 },
  ],
};

describe("computePivotModel", () => {
  it("nests rows and sums per group + subtotals + grand total", () => {
    const spec: PivotSpec = { rows: ["region", "product"], columns: [], values: [{ field: "amount", aggregate: "sum" }] };
    const m = computePivotModel(source, spec);
    const west = m.rowTree.find((n) => n.key === "West")!;
    const total = (n: typeof west) => n.values.get(`␟0`); // cellKey("", 0)
    expect(total(west)).toBe(180); // 100+50+30 — subtotal over underlying values
    const westA = west.children.find((n) => n.key === "A")!;
    expect(total(westA)).toBe(150);
    expect(m.grand.get(`␟0`)).toBe(400); // 180 + 220
  });

  it("average TOTAL is over the union of underlying values, not an average-of-averages (Excel-exact)", () => {
    const spec: PivotSpec = { rows: ["region"], columns: ["product"], values: [{ field: "amount", aggregate: "average" }] };
    const m = computePivotModel(source, spec);
    const west = m.rowTree.find((n) => n.key === "West")!;
    // West: A avg = (100+50)/2 = 75; B avg = 30. Row TOTAL avg must be (100+50+30)/3 = 60,
    // NOT (75+30)/2 = 52.5.
    expect(west.values.get(`␟0`)).toBeCloseTo(60, 6);
    // Grand average over all 5 rows = 400/5 = 80.
    expect(m.grand.get(`␟0`)).toBeCloseTo(80, 6);
  });

  it("min/max ignore non-numeric cells (Excel-consistent — a stray 'N/A' must not poison the group)", () => {
    const src: PivotSource = {
      fields: ["region", "amount"],
      rows: [
        { region: "West", amount: 100 },
        { region: "West", amount: "N/A" },
        { region: "West", amount: 40 },
      ],
    };
    const min = computePivotModel(src, { rows: ["region"], columns: [], values: [{ field: "amount", aggregate: "min" }] });
    const max = computePivotModel(src, { rows: ["region"], columns: [], values: [{ field: "amount", aggregate: "max" }] });
    expect(min.rowTree[0].values.get(`␟0`)).toBe(40); // not NaN
    expect(max.rowTree[0].values.get(`␟0`)).toBe(100); // not NaN
  });

  it("supports multiple value fields with independent aggregations", () => {
    const spec: PivotSpec = {
      rows: ["region"],
      columns: [],
      values: [
        { field: "amount", aggregate: "sum" },
        { field: "amount", aggregate: "count" },
      ],
    };
    const m = computePivotModel(source, spec);
    const west = m.rowTree.find((n) => n.key === "West")!;
    expect(west.values.get(`␟0`)).toBe(180); // sum
    expect(west.values.get(`␟1`)).toBe(3); // count
  });
});

describe("renderPivotModel", () => {
  it("renders header + grouped rows + grand total into cells", () => {
    const spec: PivotSpec = { rows: ["region", "product"], columns: [], values: [{ field: "amount", aggregate: "sum" }] };
    const out = renderPivotModel(computePivotModel(source, spec));
    // Grand-total label is present in column 0 of the last row.
    const lastRow = out.cells[out.rowCount - 1];
    expect(lastRow[0]?.v).toBe("Grand Total");
    // Grand-total value cell exists and equals 400.
    const gtVal = Object.values(lastRow).find((c) => typeof c?.v === "number");
    expect(gtVal?.v).toBe(400);
    expect(out.columnCount).toBeGreaterThan(1);
  });

  it("collapsed groups hide children but keep the group row", () => {
    const spec: PivotSpec = { rows: ["region", "product"], columns: [], values: [{ field: "amount", aggregate: "sum" }], collapsed: ["West"] };
    const full = renderPivotModel(computePivotModel(source, { ...spec, collapsed: [] }));
    const collapsed = renderPivotModel(computePivotModel(source, spec));
    expect(collapsed.rowCount).toBeLessThan(full.rowCount); // West's children (A,B) + subtotal are hidden
  });
});
