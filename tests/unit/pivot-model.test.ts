import { describe, expect, it } from "vitest";
import { ROW_TOTAL, computePivotModel, renderPivotModel, toNumber } from "../../src/features/pivot-model";
import type { PivotAggregate, PivotSource, PivotSpec } from "../../src/core/types";

describe("row Total with a BLANK column-field value (regression: must include the blank column)", () => {
    it("counts the blank-column data in the row Total + grand (not dropped)", () => {
        const src: PivotSource = {
            fields: ["region", "type", "amount"],
            rows: [
                { region: "X", type: "P", amount: 10 }, // column value present
                { region: "X", type: "", amount: 100 }, // BLANK column value → path ""
                { region: "Y", type: "P", amount: 5 },
            ],
        };
        const m = computePivotModel(src, { rows: ["region"], columns: ["type"], values: [{ field: "amount", aggregate: "sum" }] });
        const x = m.rowTree.find((n) => n.key === "X")!;
        // X row Total must be 10 + 100 = 110 (the blank-"type" 100 is NOT dropped).
        expect(x.values.get(`${ROW_TOTAL}␟0`)).toBe(110);
        // Grand row Total = 110 + 5 = 115.
        expect(m.grand.get(`${ROW_TOTAL}␟0`)).toBe(115);
        // The real "P" column still reads correctly (X=10).
        expect(x.values.get(`P␟0`)).toBe(10);
    });
});

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
    const total = (n: typeof west) => n.values.get(`${ROW_TOTAL}␟0`); // cellKey("", 0)
    expect(total(west)).toBe(180); // 100+50+30 — subtotal over underlying values
    const westA = west.children.find((n) => n.key === "A")!;
    expect(total(westA)).toBe(150);
    expect(m.grand.get(`${ROW_TOTAL}␟0`)).toBe(400); // 180 + 220
  });

  it("Sort by a VALUE orders the row groups by that value's total, honoring asc/desc", () => {
    // West total = 180, East total = 220. Default (label) order is alphabetical: East, West.
    const bySum = (order: "asc" | "desc"): string[] =>
      computePivotModel(source, {
        rows: ["region"],
        columns: [],
        values: [{ field: "amount", aggregate: "sum" }],
        dimSettings: { region: { sortBy: "amount", order } },
      }).rowTree.map((n) => n.key);
    // Ascending by total: West (180) before East (220).
    expect(bySum("asc")).toEqual(["West", "East"]);
    // Descending by total: East (220) before West (180).
    expect(bySum("desc")).toEqual(["East", "West"]);
    // Sanity: WITHOUT sortBy it falls back to label order (East, West).
    const byLabel = computePivotModel(source, { rows: ["region"], columns: [], values: [{ field: "amount", aggregate: "sum" }] }).rowTree.map((n) => n.key);
    expect(byLabel).toEqual(["East", "West"]);
  });

  it("sorts a dimension BY ITS OWN field's aggregated value (dim field == value field — multi-area)", () => {
    // The marquee multi-area case: group by `amount` AND sum `amount`, then sort the groups by
    // that SUM. Each group is one distinct amount so sum == amount; desc → 30, 10, 5.
    const src: PivotSource = { fields: ["amount"], rows: [{ amount: 5 }, { amount: 30 }, { amount: 10 }] };
    const keys = computePivotModel(src, {
      rows: ["amount"],
      columns: [],
      values: [{ field: "amount", aggregate: "sum" }],
      dimSettings: { amount: { sortBy: "amount", order: "desc" } },
    }).rowTree.map((n) => n.key);
    expect(keys).toEqual(["30", "10", "5"]); // by value desc — NOT label order (which is 10,30,5)
  });

  it("average TOTAL is over the union of underlying values, not an average-of-averages (Excel-exact)", () => {
    const spec: PivotSpec = { rows: ["region"], columns: ["product"], values: [{ field: "amount", aggregate: "average" }] };
    const m = computePivotModel(source, spec);
    const west = m.rowTree.find((n) => n.key === "West")!;
    // West: A avg = (100+50)/2 = 75; B avg = 30. Row TOTAL avg must be (100+50+30)/3 = 60,
    // NOT (75+30)/2 = 52.5.
    expect(west.values.get(`${ROW_TOTAL}␟0`)).toBeCloseTo(60, 6);
    // Grand average over all 5 rows = 400/5 = 80.
    expect(m.grand.get(`${ROW_TOTAL}␟0`)).toBeCloseTo(80, 6);
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
    expect(min.rowTree[0].values.get(`${ROW_TOTAL}␟0`)).toBe(40); // not NaN
    expect(max.rowTree[0].values.get(`${ROW_TOTAL}␟0`)).toBe(100); // not NaN
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
    expect(west.values.get(`${ROW_TOTAL}␟0`)).toBe(180); // sum
    expect(west.values.get(`${ROW_TOTAL}␟1`)).toBe(3); // count
  });
});

/** Brute-force reference: scan the raw rows for a (rowPath-prefix, colPath|null)
 *  group and aggregate directly — the O(n²) definition we optimise away. */
function bruteAgg(
  rows: Array<Record<string, unknown>>,
  rowFields: string[],
  colFields: string[],
  rowPrefix: string[] | null,
  colPath: string[] | null,
  field: string,
  agg: PivotAggregate,
): number {
  const nums: number[] = [];
  for (const r of rows) {
    if (rowPrefix) {
      let ok = true;
      for (let i = 0; i < rowPrefix.length; i++) if (String(r[rowFields[i]] ?? "") !== rowPrefix[i]) { ok = false; break; }
      if (!ok) continue;
    }
    if (colPath) {
      let ok = true;
      for (let i = 0; i < colPath.length; i++) if (String(r[colFields[i]] ?? "") !== colPath[i]) { ok = false; break; }
      if (!ok) continue;
    }
    const v = r[field];
    const n = typeof v === "number" ? v : Number(v);
    nums.push(Number.isFinite(n) ? n : NaN);
  }
  switch (agg) {
    case "count": return nums.length;
    case "countNumbers": return nums.filter(Number.isFinite).length;
    case "average": { const f = nums.filter(Number.isFinite); return f.length ? f.reduce((s, x) => s + x, 0) / f.length : 0; }
    case "min": { const f = nums.filter(Number.isFinite); return f.length ? Math.min(...f) : 0; }
    case "max": { const f = nums.filter(Number.isFinite); return f.length ? Math.max(...f) : 0; }
    default: return nums.reduce((s, x) => s + (Number.isFinite(x) ? x : 0), 0);
  }
}

describe("computePivotModel — roll-up accumulators", () => {
  it("matches a brute-force reference on a small multi-level, multi-col, multi-value case", () => {
    const src: PivotSource = {
      fields: ["region", "product", "year", "amount"],
      rows: [
        { region: "West", product: "A", year: "2023", amount: 100 },
        { region: "West", product: "A", year: "2024", amount: 50 },
        { region: "West", product: "B", year: "2023", amount: 30 },
        { region: "West", product: "B", year: "2024", amount: "N/A" },
        { region: "East", product: "A", year: "2023", amount: 200 },
        { region: "East", product: "A", year: "2024", amount: 20 },
        { region: "East", product: "B", year: "2023", amount: 5 },
      ],
    };
    const aggs: PivotAggregate[] = ["sum", "count", "average", "min", "max", "countNumbers"];
    for (const agg of aggs) {
      const spec: PivotSpec = { rows: ["region", "product"], columns: ["year"], values: [{ field: "amount", aggregate: agg }] };
      const m = computePivotModel(src, spec);
      const cols = m.colLeaves.filter((c) => c !== "");
      for (const region of m.rowTree) {
        // node level
        for (const col of cols) {
          expect(region.values.get(`${col}␟0`)).toBeCloseTo(bruteAgg(src.rows, spec.rows, spec.columns, [region.key], col.split("␟"), "amount", agg), 6);
        }
        // row Total (all columns)
        expect(region.values.get(`${ROW_TOTAL}␟0`)).toBeCloseTo(bruteAgg(src.rows, spec.rows, spec.columns, [region.key], null, "amount", agg), 6);
        for (const prod of region.children) {
          expect(prod.values.get(`${ROW_TOTAL}␟0`)).toBeCloseTo(bruteAgg(src.rows, spec.rows, spec.columns, [region.key, prod.key], null, "amount", agg), 6);
        }
      }
      // grand
      expect(m.grand.get(`${ROW_TOTAL}␟0`)).toBeCloseTo(bruteAgg(src.rows, spec.rows, spec.columns, null, null, "amount", agg), 6);
    }
  });

  it("computes a 5k-row × 3-level × 2-col × 2-value pivot in well under a second", () => {
    const rows: Array<Record<string, unknown>> = [];
    for (let i = 0; i < 5000; i++) {
      rows.push({
        region: `R${i % 4}`,
        product: `P${i % 10}`,
        sku: `S${i % 25}`,
        quarter: `Q${i % 4}`,
        channel: `C${i % 3}`,
        amount: (i % 97) + 1,
        qty: (i % 13) + 1,
      });
    }
    const src: PivotSource = { fields: Object.keys(rows[0]), rows };
    const spec: PivotSpec = {
      rows: ["region", "product", "sku"],
      columns: ["quarter", "channel"],
      values: [
        { field: "amount", aggregate: "sum" },
        { field: "qty", aggregate: "average" },
      ],
    };
    const t0 = performance.now();
    const m = computePivotModel(src, spec);
    const ms = performance.now() - t0;
    expect(m.rowTree.length).toBe(4);
    expect(ms).toBeLessThan(1000);

    // Spot-check exactness against brute force on one deep node + grand.
    const first = m.rowTree[0].children[0].children[0];
    expect(first.values.get(`${ROW_TOTAL}␟0`)).toBeCloseTo(
      bruteAgg(rows, spec.rows, spec.columns, [m.rowTree[0].key, m.rowTree[0].children[0].key, first.key], null, "amount", "sum"),
      6,
    );
    expect(m.grand.get(`${ROW_TOTAL}␟1`)).toBeCloseTo(bruteAgg(rows, spec.rows, spec.columns, null, null, "qty", "average"), 6);
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

describe("computePivotModel — the extra Google aggregates + Show-as", () => {
  const src = {
    fields: ["g", "x"],
    rows: [
      { g: "A", x: 2 },
      { g: "A", x: 4 },
      { g: "A", x: 4 },
      { g: "B", x: 10 },
    ],
  };
  const model = (agg: string) => computePivotModel(src as never, { rows: ["g"], columns: [], values: [{ field: "x", aggregate: agg as never }] });
  const total = (m: ReturnType<typeof computePivotModel>, key: string) => m.rowTree.find((n) => n.key === key)!.values.get(`${ROW_TOTAL}␟0`);

  it("MEDIAN", () => { const m = model("median"); expect(total(m, "A")).toBe(4); }); // [2,4,4] → 4
  it("COUNTUNIQUE", () => { const m = model("countunique"); expect(total(m, "A")).toBe(2); }); // {2,4}
  it("PRODUCT", () => { const m = model("product"); expect(total(m, "A")).toBe(32); }); // 2*4*4
  it("STDEVP (population)", () => { const m = model("stdevp"); expect(total(m, "A")).toBeCloseTo(0.9428, 3); });
  it("VAR (sample)", () => { const m = model("var"); expect(total(m, "A")).toBeCloseTo(4 / 3, 6); });
  it("STDEV of a single value is 0 (n<2)", () => { const m = model("stdev"); expect(total(m, "B")).toBe(0); });

  it("Show-as % of grand total re-bases each row's total", () => {
    const m = computePivotModel(src as never, { rows: ["g"], columns: [], values: [{ field: "x", aggregate: "sum", showAs: "pctOfGrand" }] });
    const rendered = renderPivotModel(m);
    // A sum=10, B sum=10, grand=20 → each row total is 0.5 (50%).
    const cellVals = Object.values(rendered.cells).flatMap((row) => Object.values(row)).map((c) => c?.v);
    expect(cellVals).toContain(0.5);
  });
});

describe("toNumber — the shared numeric parser (also drives Values aggregate auto-detection)", () => {
  it("parses currency, accounting negatives, and percents as numbers; text as NaN", () => {
    expect(toNumber(1234)).toBe(1234);
    expect(toNumber("$196,282.09")).toBeCloseTo(196282.09, 2);
    expect(toNumber("(196,282.09)")).toBeCloseTo(-196282.09, 2); // accounting negative
    expect(toNumber("£1,020")).toBe(1020); // non-$ currency
    expect(toNumber("¥500")).toBe(500);
    expect(toNumber("45%")).toBeCloseTo(0.45, 4);
    expect(Number.isNaN(toNumber("High"))).toBe(true); // text → NaN → COUNTA, not SUM
    expect(Number.isNaN(toNumber(""))).toBe(true);
  });
});

describe("Wave 3 — value cells inherit the source column number format (currency), except counts", () => {
  const src: PivotSource = { fields: ["r", "amt"], rows: [{ r: "X", amt: 10 }], numFmt: { amt: "$#,##0.00" } };
  const patternAt = (spec: PivotSpec) => {
    const region = renderPivotModel(computePivotModel(src, spec));
    for (let rr = 0; rr < region.rowCount; rr++)
      for (let c = 1; c < region.columnCount; c++) {
        const p = (region.cells[rr]?.[c] as { s?: { n?: { pattern?: string } } } | undefined)?.s?.n?.pattern;
        if (p) return p;
      }
    return undefined;
  };
  it("a SUM value inherits the source currency format", () => {
    expect(patternAt({ rows: ["r"], columns: [], values: [{ field: "amt", aggregate: "sum" }] })).toBe("$#,##0.00");
  });
  it("a COUNT value stays an integer (ignores the source currency format)", () => {
    expect(patternAt({ rows: ["r"], columns: [], values: [{ field: "amt", aggregate: "count" }] })).toBe("#,##0");
  });
  it("an explicit value numFmt overrides the inherited source format", () => {
    expect(patternAt({ rows: ["r"], columns: [], values: [{ field: "amt", aggregate: "sum", numFmt: "0.0%" }] })).toBe("0.0%");
  });
});

describe("Wave 3 — filter by condition (applied before aggregation, changes totals)", () => {
  const src: PivotSource = {
    fields: ["region", "type", "amount"],
    rows: [
      { region: "West", type: "Journal", amount: 100 },
      { region: "East", type: "Invoice", amount: 50 },
      { region: "West", type: "Journal", amount: 30 },
      { region: "East", type: "", amount: 999 }, // blank type
    ],
  };
  const grand = (spec: PivotSpec) => computePivotModel(src, spec).grand.get(`${ROW_TOTAL}␟0`);

  it("numeric 'greater than' filters rows before aggregation", () => {
    const spec: PivotSpec = { rows: [], columns: [], values: [{ field: "amount", aggregate: "sum" }], filters: [{ field: "amount", condition: { type: "gt", value: 40 } }] };
    // Keeps 100, 50, 999 (>40); drops 30 → sum 1149.
    expect(grand(spec)).toBe(1149);
  });

  it("text 'contains' filters (case-insensitive)", () => {
    const spec: PivotSpec = { rows: [], columns: [], values: [{ field: "amount", aggregate: "sum" }], filters: [{ field: "type", condition: { type: "textContains", value: "jour" } }] };
    // Only "Journal" rows (100 + 30) = 130.
    expect(grand(spec)).toBe(130);
  });

  it("'is not empty' drops blank-value rows", () => {
    const spec: PivotSpec = { rows: [], columns: [], values: [{ field: "amount", aggregate: "sum" }], filters: [{ field: "type", condition: { type: "isNotEmpty" } }] };
    // Drops the blank-type row (999) → 100 + 50 + 30 = 180.
    expect(grand(spec)).toBe(180);
  });

  it("'between' filters an inclusive numeric range", () => {
    const spec: PivotSpec = { rows: [], columns: [], values: [{ field: "amount", aggregate: "sum" }], filters: [{ field: "amount", condition: { type: "between", value: 30, value2: 100 } }] };
    // Keeps 100, 50, 30 (30..100); drops 999 → 180.
    expect(grand(spec)).toBe(180);
  });

  it("combines a condition with a by-values include (both must pass)", () => {
    const spec: PivotSpec = { rows: [], columns: [], values: [{ field: "amount", aggregate: "sum" }], filters: [{ field: "region", include: ["West"], condition: undefined }, { field: "amount", condition: { type: "gt", value: 50 } }] };
    // region=West (100, 30) AND amount>50 → only 100.
    expect(grand(spec)).toBe(100);
  });
});

describe("Wave 2 — date grouping + numeric bucketing (Google Sheets 'Group by')", () => {
  const dated: PivotSource = {
    fields: ["d", "amt"],
    rows: [
      { d: "2024-01-15", amt: 10 },
      { d: "2024-01-20", amt: 5 },
      { d: "2024-02-03", amt: 7 },
      { d: "2023-12-31", amt: 3 },
      { d: "2024-03-10", amt: 9 },
    ],
  };
  const keysOf = (spec: PivotSpec) => computePivotModel(dated, spec).rowTree.map((n) => n.key);
  const totalOf = (spec: PivotSpec, key: string) => {
    const n = computePivotModel(dated, spec).rowTree.find((x) => x.key === key);
    return n?.values.get(`${ROW_TOTAL}␟0`);
  };

  it("groups a date field by MONTH with month-name labels in calendar order (not lexical)", () => {
    const spec: PivotSpec = { rows: ["d"], columns: [], values: [{ field: "amt", aggregate: "sum" }], dimSettings: { d: { groupRule: { kind: "date", part: "month" } } } };
    // Buckets: December(3), January(15), February(7), March(9). Calendar order Jan..Dec, but our
    // data has Dec/Jan/Feb/Mar → sorted by month index: January, February, March, December.
    expect(keysOf(spec)).toEqual(["January", "February", "March", "December"]);
    expect(totalOf(spec, "January")).toBe(15); // 10 + 5
  });

  it("groups by YEAR-MONTH (chronological)", () => {
    const spec: PivotSpec = { rows: ["d"], columns: [], values: [{ field: "amt", aggregate: "sum" }], dimSettings: { d: { groupRule: { kind: "date", part: "yearMonth" } } } };
    expect(keysOf(spec)).toEqual(["2023-12", "2024-01", "2024-02", "2024-03"]);
    expect(totalOf(spec, "2024-01")).toBe(15);
  });

  it("groups by QUARTER", () => {
    const spec: PivotSpec = { rows: ["d"], columns: [], values: [{ field: "amt", aggregate: "sum" }], dimSettings: { d: { groupRule: { kind: "date", part: "quarter" } } } };
    expect(keysOf(spec)).toEqual(["Q1", "Q4"]); // 2024 Q1 (Jan+Feb+Mar), 2023 Q4 (Dec)
  });

  it("groups NUMERIC Excel-serial dates and Date objects (not just date strings) — PSE P1", () => {
    // Excel serial 45306 = 2024-01-15; 45689 = 2025-02-01 (approx). Univer/xlsx store dates as serials.
    const serial = { fields: ["d", "amt"], rows: [{ d: 45306, amt: 4 }, { d: new Date(Date.UTC(2024, 0, 20)), amt: 6 }] } as PivotSource;
    const spec: PivotSpec = { rows: ["d"], columns: [], values: [{ field: "amt", aggregate: "sum" }], dimSettings: { d: { groupRule: { kind: "date", part: "yearMonth" } } } };
    const m = computePivotModel(serial, spec);
    // Both land in 2024-01 → single group, summed. (Serial 45306 → Jan 2024; Date → Jan 2024.)
    expect(m.rowTree.map((n) => n.key)).toEqual(["2024-01"]);
    expect(m.rowTree[0].values.get(`${ROW_TOTAL}␟0`)).toBe(10);
  });

  it("present-but-all-blank COUNTA group shows 0, while a truly ABSENT intersection is blank", () => {
    const src2: PivotSource = {
      fields: ["r", "c", "t"],
      rows: [
        { r: "X", c: "P", t: "" }, // X×P present, value blank → COUNTA 0
        { r: "Y", c: "Q", t: "hi" }, // Y×Q present, value present → COUNTA 1
      ],
    };
    const m = computePivotModel(src2, { rows: ["r"], columns: ["c"], values: [{ field: "t", aggregate: "count" }] });
    const x = m.rowTree.find((n) => n.key === "X")!;
    const y = m.rowTree.find((n) => n.key === "Y")!;
    expect(x.values.get("P␟0")).toBe(0); // present but blank → 0
    expect(x.values.has("Q␟0")).toBe(false); // X×Q absent → not present → renders blank
    expect(y.values.get("Q␟0")).toBe(1);
  });

  it("groups a numeric field into fixed-size buckets sorted by lower bound", () => {
    const src: PivotSource = { fields: ["amt"], rows: [{ amt: 5 }, { amt: 150 }, { amt: 1050 }, { amt: 95 }] };
    const spec: PivotSpec = { rows: ["amt"], columns: [], values: [{ field: "amt", aggregate: "count" }], dimSettings: { amt: { groupRule: { kind: "number", size: 100 } } } };
    const keys = computePivotModel(src, spec).rowTree.map((n) => n.key);
    // 5→"0 – 100", 95→"0 – 100", 150→"100 – 200", 1050→"1000 – 1100"; sorted by lower bound.
    expect(keys).toEqual(["0 – 100", "100 – 200", "1000 – 1100"]);
  });
});

describe("Wave 1 correctness — (blank) labels, blank column, COUNTA non-empty, count format, columns-only", () => {
  const src: PivotSource = {
    fields: ["region", "type", "amount"],
    rows: [
      { region: "X", type: "A", amount: 10 },
      { region: "X", type: "", amount: 20 }, // blank type
      { region: "", type: "A", amount: 5 }, // blank region
    ],
  };
  const cell = (region: ReturnType<typeof renderPivotModel>, r: number, c: number) => (region.cells[r]?.[c] as { v?: unknown } | undefined)?.v;

  it("renders '(blank)' for an empty ROW group key", () => {
    const region = renderPivotModel(computePivotModel(src, { rows: ["region"], columns: [], values: [{ field: "amount", aggregate: "sum" }] }));
    const labels: unknown[] = [];
    for (let r = 0; r < region.rowCount; r++) labels.push(cell(region, r, 0));
    expect(labels).toContain("(blank)"); // the empty-region group shows "(blank)", not ""
    expect(labels).not.toContain(""); // no empty label leaks through as a data row
  });

  it("keeps a blank COLUMN group and labels it '(blank)' (does not drop it)", () => {
    const region = renderPivotModel(computePivotModel(src, { rows: ["region"], columns: ["type"], values: [{ field: "amount", aggregate: "sum" }] }));
    // Column values are A and "" → headers "A" and "(blank)". Row 1 (values header) holds them.
    const header1: unknown[] = [];
    for (let c = 0; c < region.columnCount; c++) header1.push(cell(region, 1, c));
    expect(header1).toContain("A");
    expect(header1).toContain("(blank)"); // blank column not dropped
  });

  it("COUNTA counts NON-EMPTY values only (blank cells excluded), like Google Sheets", () => {
    // 3 rows; the `type` column has one blank → COUNTA of type = 2, not 3.
    const m = computePivotModel(src, { rows: [], columns: [], values: [{ field: "type", aggregate: "count" }] });
    expect(m.grand.get(`${ROW_TOTAL}␟0`)).toBe(2);
  });

  it("count aggregates render as integers (#,##0), not 2 decimals", () => {
    const region = renderPivotModel(computePivotModel(src, { rows: ["region"], columns: [], values: [{ field: "type", aggregate: "count" }] }));
    // Find a count cell and check its number pattern has no decimals.
    let pat: string | undefined;
    for (let r = 0; r < region.rowCount && !pat; r++)
      for (let c = 1; c < region.columnCount; c++) {
        const s = (region.cells[r]?.[c] as { s?: { n?: { pattern?: string } } } | undefined)?.s;
        if (s?.n?.pattern) { pat = s.n.pattern; break; }
      }
    expect(pat).toBe("#,##0");
  });

  it("columns-only pivot (no rows) renders headers + Grand Total, no synthetic empty row", () => {
    const region = renderPivotModel(computePivotModel(src, { rows: [], columns: ["type"], values: [{ field: "amount", aggregate: "sum" }] }));
    const col0: unknown[] = [];
    for (let r = 0; r < region.rowCount; r++) col0.push(cell(region, r, 0));
    // The only labelled body row is "Grand Total"; no blank synthetic row-group.
    expect(col0).toContain("Grand Total");
    expect(col0.filter((v) => v === "").length).toBeLessThanOrEqual(2); // header corners only
  });
});

describe("follow-ups: blank empty intersections + chronological date sort", () => {
  it("leaves an intersection with NO source rows BLANK (not 0), like Google Sheets", () => {
    const src: PivotSource = {
      fields: ["r", "p", "amt"],
      rows: [
        { r: "X", p: "A", amt: 10 },
        { r: "Y", p: "B", amt: 20 },
      ],
    };
    const region = renderPivotModel(computePivotModel(src, { rows: ["r"], columns: ["p"], values: [{ field: "amt", aggregate: "sum" }] }));
    const val = (r: number, c: number) => (region.cells[r]?.[c] as { v?: unknown } | undefined)?.v;
    // Header: row0 = "p", row1 = "r" | A | B | Grand Total. Data: row2 = X, row3 = Y. cols A=1, B=2, total=3.
    expect(val(2, 1)).toBe(10); // X × A has data
    expect(val(2, 2)).toBe(""); // X × B has NO rows → blank (not 0)
    expect(val(3, 1)).toBe(""); // Y × A has NO rows → blank
    expect(val(3, 2)).toBe(20); // Y × B has data
    expect(val(2, 3)).toBe(10); // row totals stay present (genuine numbers)
    expect(val(3, 3)).toBe(20);
  });

  it("sorts DATE row labels CHRONOLOGICALLY, not lexically (matches Google Sheets)", () => {
    const src: PivotSource = { fields: ["d"], rows: [{ d: "12/31/2019" }, { d: "01/01/2020" }, { d: "02/15/2020" }] };
    const keys = computePivotModel(src, { rows: ["d"], columns: [], values: [] }).rowTree.map((n) => n.key);
    // Chronological: 12/31/2019 < 01/01/2020 < 02/15/2020 (lexical would wrongly put 01/01/2020 first).
    expect(keys).toEqual(["12/31/2019", "01/01/2020", "02/15/2020"]);
  });

  it("sorts ISO date labels chronologically too", () => {
    const src: PivotSource = { fields: ["d"], rows: [{ d: "2020-02-15" }, { d: "2019-12-31" }, { d: "2020-01-01" }] };
    const keys = computePivotModel(src, { rows: ["d"], columns: [], values: [] }).rowTree.map((n) => n.key);
    expect(keys).toEqual(["2019-12-31", "2020-01-01", "2020-02-15"]);
  });
});

describe("column ORDER (Ascending/Descending) — #37: the Order control must re-sort columns", () => {
  it("sorts column leaves ascending by default and descending when Order=desc", () => {
    const asc = computePivotModel(source, { rows: ["region"], columns: ["product"], values: [{ field: "amount", aggregate: "sum" }] });
    expect(asc.colLeaves).toEqual(["A", "B"]);
    const desc = computePivotModel(source, {
      rows: ["region"],
      columns: ["product"],
      values: [{ field: "amount", aggregate: "sum" }],
      dimSettings: { product: { order: "desc" } },
    });
    expect(desc.colLeaves).toEqual(["B", "A"]);
  });

  it("row Order sorts numeric labels by VALUE incl. negatives + thousands separators (not lexically)", () => {
    const src: PivotSource = {
      fields: ["k"],
      rows: [{ k: "-10" }, { k: "-5" }, { k: "1,000" }, { k: "900" }, { k: "2,000" }],
    };
    const keys = computePivotModel(src, { rows: ["k"], columns: [], values: [] }).rowTree.map((n) => n.key);
    // Ascending by numeric value: -10, -5, 900, 1,000, 2,000 (lexical would mis-order all of these).
    expect(keys).toEqual(["-10", "-5", "900", "1,000", "2,000"]);
  });

  it("sorts a NUMERIC column field by value, not lexically (matches Google Sheets)", () => {
    const src: PivotSource = {
      fields: ["r", "amt"],
      rows: [
        { r: "x", amt: 100 },
        { r: "x", amt: 9 },
        { r: "x", amt: 30 },
      ],
    };
    const m = computePivotModel(src, { rows: ["r"], columns: ["amt"], values: [{ field: "amt", aggregate: "count" }] });
    // 9 < 30 < 100 numerically (lexical string sort would give "100","30","9").
    expect(m.colLeaves).toEqual(["9", "30", "100"]);
  });
});

describe("header labeling (Google-Sheets) — column FIELD NAME on top, distinct VALUES below (no duplication)", () => {
  it("rows + columns + one value: row0 = column field name, row1 = column values (not a numeric duplicate)", () => {
    const m = computePivotModel(source, { rows: ["region"], columns: ["product"], values: [{ field: "amount", aggregate: "sum" }] });
    const region = renderPivotModel(m);
    const val = (r: number, c: number) => (region.cells[r]?.[c] as { v?: unknown } | undefined)?.v;
    // Row 0: the COLUMN FIELD NAME ("product"), NOT the first column value.
    expect(val(0, 1)).toBe("product");
    // Row 1: row field name in the corner, then the distinct column values A, B.
    expect(val(1, 0)).toBe("region");
    expect([val(1, 1), val(1, 2)].sort()).toEqual(["A", "B"]);
    // The two header rows must NOT be identical (the old duplicate bug).
    expect(val(0, 1)).not.toBe(val(1, 1));
  });

  it("rows + one value, NO columns: the value column is labelled with the value name (not 'Grand Total')", () => {
    const m = computePivotModel(source, { rows: ["region"], columns: [], values: [{ field: "amount", aggregate: "sum" }] });
    const region = renderPivotModel(m);
    const val = (r: number, c: number) => (region.cells[r]?.[c] as { v?: unknown } | undefined)?.v;
    expect(val(0, 0)).toBe("region"); // row field name in the corner
    expect(val(0, 1)).toBe("Sum of amount"); // value name as the column header, GS-style
  });
});

describe("empty / rows-only pivots (Google-Sheets behavior — no invented COUNT, no phantom Grand Total)", () => {
  it("a fully-empty spec renders the Google-Sheets placeholder scaffold (Columns/Rows/Values), no computed data", () => {
    const empty: PivotSpec = { rows: [], columns: [], values: [] };
    const region = renderPivotModel(computePivotModel(source, empty));
    expect(region.rowCount).toBe(2);
    expect(region.columnCount).toBe(2);
    expect(region.cells[0]?.[1]?.v).toBe("Columns"); // B1
    expect(region.cells[1]?.[0]?.v).toBe("Rows"); // A2
    expect(region.cells[1]?.[1]?.v).toBe("Values"); // B2
    // No invented Grand Total / numeric artifact anywhere in the scaffold.
    expect(region.cells[0]?.[0]).toBeUndefined();
  });

  it("rows-only (no values) groups by the row field but renders NO value cells / no numeric Grand Total", () => {
    const spec: PivotSpec = { rows: ["region"], columns: [], values: [] };
    const m = computePivotModel(source, spec);
    // Grouping still happens (distinct regions), but the model carries no invented value.
    expect(m.rowTree.map((n) => n.key).sort()).toEqual(["East", "West"]);
    expect(m.values.length).toBe(0);
    const region = renderPivotModel(m);
    // Only the row-label column exists (col 0); no value/Grand-Total columns.
    expect(region.columnCount).toBe(1);
    // No "Grand Total" row is emitted when there are no values to total.
    const hasGrandTotal = Object.values(region.cells).some((row) => Object.values(row).some((c) => (c as { v?: unknown }).v === "Grand Total"));
    expect(hasGrandTotal).toBe(false);
  });
});

describe("numeric coercion of imported currency/formatted strings (SUM must not silently return 0)", () => {
  it("sums cells stored as display strings ($, commas, accounting parens, %)", () => {
    const src: PivotSource = {
      fields: ["type", "credit"],
      rows: [
        { type: "J", credit: "$196,282.09" }, // currency string
        { type: "J", credit: "15,094.96" }, // thousands separator
        { type: "J", credit: "(1,000.00)" }, // accounting negative
        { type: "J", credit: 100 }, // already a number
      ],
    };
    const m = computePivotModel(src, { rows: ["type"], columns: [], values: [{ field: "credit", aggregate: "sum" }] });
    const j = m.rowTree.find((n) => n.key === "J")!;
    // 196282.09 + 15094.96 - 1000 + 100 = 210477.05
    expect(j.values.get(`${ROW_TOTAL}␟0`)).toBeCloseTo(210477.05, 2);
  });
});

describe("columns without values still lay out their labels (Image #13 fix)", () => {
  it("renders the distinct COLUMN values as headers even when Values is empty", () => {
    const src: PivotSource = {
      fields: ["type", "region"],
      rows: [
        { type: "J", region: "West" },
        { type: "J", region: "East" },
      ],
    };
    const m = computePivotModel(src, { rows: ["type"], columns: ["region"], values: [] });
    const region = renderPivotModel(m);
    // 2 distinct columns (East, West) → row-label col + 2 column slots.
    expect(region.columnCount).toBe(3);
    // Google-Sheets header layout: row 0 = the COLUMN FIELD NAME, row 1 = the distinct values.
    const val = (r: number, c: number) => (region.cells[r]?.[c] as { v?: unknown } | undefined)?.v;
    expect(val(0, 1)).toBe("region"); // column field name on top
    const labels = [val(1, 1), val(1, 2)].sort();
    expect(labels).toEqual(["East", "West"]); // distinct column values below
  });
})
