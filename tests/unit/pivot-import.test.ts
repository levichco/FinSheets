/**
 * pivot-import parser tests.
 *
 * ExcelJS can't WRITE pivot parts, so we synthesise a minimal but realistic
 * `.xlsx`: build a source-data sheet with ExcelJS, then inject `pivotTable1.xml`
 * + `pivotCacheDefinition1.xml` (+ optionally `pivotCacheRecords1.xml`) into the
 * ZIP with jszip. Then run it through `parseXlsxToSnapshot` (PRIMARY: in-workbook
 * source slice) and a source-less variant (FALLBACK: embedded cache records).
 */
import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { parseXlsxToSnapshot } from "../../src/core/xlsx-to-snapshot";
import { parsePivotsFromXlsx, mapSubtotal } from "../../src/core/pivot-import";
import { computePivotModel } from "../../src/features/pivot-model";
import type { WorkbookData } from "../../src/core/types";

const CACHE_DEF = (opts: { withSource: boolean; saveData?: boolean }): string => `<?xml version="1.0"?>
<pivotCacheDefinition xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"${opts.saveData === false ? ' saveData="0"' : ""}>
  ${opts.withSource ? '<cacheSource type="worksheet"><worksheetSource ref="A1:C6" sheet="Data"/></cacheSource>' : '<cacheSource type="worksheet"/>'}
  <cacheFields count="3">
    <cacheField name="region"><sharedItems><s v="West"/><s v="East"/></sharedItems></cacheField>
    <cacheField name="product"><sharedItems><s v="A"/><s v="B"/></sharedItems></cacheField>
    <cacheField name="amount"><sharedItems containsSemiMixedTypes="0" containsString="0" containsNumber="1"/></cacheField>
  </cacheFields>
</pivotCacheDefinition>`;

// rowFields → region(0), product(1); colFields → none; dataFields → sum of amount(2).
const PIVOT_TABLE = `<?xml version="1.0"?>
<pivotTableDefinition xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" name="PivotTable1" cacheId="1">
  <location ref="E3:F10" firstHeaderRow="1" firstDataRow="2" firstDataCol="1"/>
  <pivotFields count="3">
    <pivotField axis="axisRow" showAll="0"/>
    <pivotField axis="axisRow" showAll="0"/>
    <pivotField dataField="1" showAll="0"/>
  </pivotFields>
  <rowFields count="2"><field x="0"/><field x="1"/></rowFields>
  <colFields count="1"><field x="-2"/></colFields>
  <dataFields count="1"><dataField name="Sum of amount" fld="2" baseField="0" baseItem="0" subtotal="sum"/></dataFields>
</pivotTableDefinition>`;

// Records for the FALLBACK path (region idx, product idx, amount number).
const CACHE_RECORDS = `<?xml version="1.0"?>
<pivotCacheRecords xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="5">
  <r><x v="0"/><x v="0"/><n v="100"/></r>
  <r><x v="0"/><x v="0"/><n v="50"/></r>
  <r><x v="0"/><x v="1"/><n v="30"/></r>
  <r><x v="1"/><x v="0"/><n v="200"/></r>
  <r><x v="1"/><x v="1"/><n v="20"/></r>
</pivotCacheRecords>`;

/** Build a base .xlsx with a "Data" source sheet, then inject pivot parts. */
async function makePivotXlsx(opts: { withSource: boolean; withRecords: boolean; saveData?: boolean }): Promise<{ name: string; arrayBuffer: () => Promise<ArrayBuffer> }> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Data");
  ws.addRow(["region", "product", "amount"]);
  ws.addRow(["West", "A", 100]);
  ws.addRow(["West", "A", 50]);
  ws.addRow(["West", "B", 30]);
  ws.addRow(["East", "A", 200]);
  ws.addRow(["East", "B", 20]);

  const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  const zip = await JSZip.loadAsync(buf);
  zip.file("xl/pivotTables/pivotTable1.xml", PIVOT_TABLE);
  zip.file("xl/pivotCache/pivotCacheDefinition1.xml", CACHE_DEF({ withSource: opts.withSource, saveData: opts.saveData }));
  if (opts.withRecords) zip.file("xl/pivotCache/pivotCacheRecords1.xml", CACHE_RECORDS);
  const out = (await zip.generateAsync({ type: "uint8array" })) as Uint8Array;
  const ab = out.slice().buffer;
  return { name: "pivot.xlsx", arrayBuffer: async () => ab };
}

describe("mapSubtotal", () => {
  it("maps Excel subtotal tokens to PivotAggregate", () => {
    expect(mapSubtotal("sum")).toBe("sum");
    expect(mapSubtotal("average")).toBe("average");
    expect(mapSubtotal("count")).toBe("count");
    expect(mapSubtotal("countNums")).toBe("countNumbers");
    expect(mapSubtotal("min")).toBe("min");
    expect(mapSubtotal("max")).toBe("max");
    expect(mapSubtotal(undefined)).toBe("sum"); // Excel default
    expect(mapSubtotal("product")).toBe("sum"); // unsupported → sum
  });
});

describe("parsePivotsFromXlsx — PRIMARY (in-workbook source slice)", () => {
  it("reconstructs source + spec by slicing the worksheetSource range", async () => {
    const file = await makePivotXlsx({ withSource: true, withRecords: false });
    const snap = (await parseXlsxToSnapshot(file as unknown as File)) as WorkbookData & { pivotsImport?: unknown };

    const pivots = (snap.pivotsImport as Array<{ location: { row: number; column: number }; source: import("../../src/core/types").PivotSource; spec: import("../../src/core/types").PivotSpec }>) ?? [];
    expect(pivots.length).toBe(1);
    const p = pivots[0];

    // Spec from layout.
    expect(p.spec.rows).toEqual(["region", "product"]);
    expect(p.spec.columns).toEqual([]);
    expect(p.spec.values).toEqual([{ field: "amount", aggregate: "sum", label: "Sum of amount" }]);

    // Location E3 → row 2, col 4 (0-based).
    expect(p.location).toEqual({ row: 2, column: 4 });

    // Source sliced from the Data sheet.
    expect(p.source.fields).toEqual(["region", "product", "amount"]);
    expect(p.source.rows.length).toBe(5);
    expect(p.source.rows[0]).toEqual({ region: "West", product: "A", amount: 100 });

    // And it computes into a correct pivot.
    const m = computePivotModel(p.source, p.spec);
    expect(m.grand.get("␟0")).toBe(400);
    expect(m.rowTree.find((n) => n.key === "West")!.values.get("␟0")).toBe(180);
  });
});

describe("parsePivotsFromXlsx — FALLBACK (embedded cache records)", () => {
  it("parses pivotCacheRecords when there is no in-workbook source", async () => {
    const file = await makePivotXlsx({ withSource: false, withRecords: true });
    const bytes = await file.arrayBuffer();
    // Build the snapshot too (its source slice will fail → fallback kicks in).
    const snap = (await parseXlsxToSnapshot(file as unknown as File)) as WorkbookData;
    const pivots = await parsePivotsFromXlsx(bytes, snap);

    expect(pivots.length).toBe(1);
    const p = pivots[0];
    expect(p.source.fields).toEqual(["region", "product", "amount"]);
    expect(p.source.rows.length).toBe(5);
    // Shared-item indices resolved back to values.
    expect(p.source.rows[2]).toEqual({ region: "West", product: "B", amount: 30 });
    const m = computePivotModel(p.source, p.spec);
    expect(m.grand.get("␟0")).toBe(400);
  });
});

/* -------------------------------------------------------------------------- */
/* Exact table↔cache pairing via rels (2-cache workbook)                      */
/* -------------------------------------------------------------------------- */

// Two distinct caches over two distinct source sheets, with the pivotTable rels
// CROSSED relative to numeric order (pivotTable1 → cache2, pivotTable2 → cache1)
// so a numeric/heuristic pairing would swap them. Field sets differ so a wrong
// pairing yields a demonstrably wrong spec + source.

// Cache 1: sales data (region, product, amount) over sheet "Sales".
const CACHE_DEF_1 = `<?xml version="1.0"?>
<pivotCacheDefinition xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cacheSource type="worksheet"><worksheetSource ref="A1:C4" sheet="Sales"/></cacheSource>
  <cacheFields count="3">
    <cacheField name="region"><sharedItems/></cacheField>
    <cacheField name="product"><sharedItems/></cacheField>
    <cacheField name="amount"><sharedItems containsNumber="1"/></cacheField>
  </cacheFields>
</pivotCacheDefinition>`;

// Cache 2: headcount data (dept, region, headcount) over sheet "HR".
const CACHE_DEF_2 = `<?xml version="1.0"?>
<pivotCacheDefinition xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cacheSource type="worksheet"><worksheetSource ref="A1:C4" sheet="HR"/></cacheSource>
  <cacheFields count="3">
    <cacheField name="dept"><sharedItems/></cacheField>
    <cacheField name="region"><sharedItems/></cacheField>
    <cacheField name="headcount"><sharedItems containsNumber="1"/></cacheField>
  </cacheFields>
</pivotCacheDefinition>`;

// pivotTable1 → rows=dept,region values=sum(headcount)  (belongs to cache2/HR)
const PIVOT_TABLE_1 = `<?xml version="1.0"?>
<pivotTableDefinition xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" name="PivotHR" cacheId="2">
  <location ref="E3:F10" firstHeaderRow="1" firstDataRow="2" firstDataCol="1"/>
  <rowFields count="2"><field x="0"/><field x="1"/></rowFields>
  <colFields count="1"><field x="-2"/></colFields>
  <dataFields count="1"><dataField name="Sum of headcount" fld="2" subtotal="sum"/></dataFields>
</pivotTableDefinition>`;

// pivotTable2 → rows=region,product values=sum(amount)  (belongs to cache1/Sales)
const PIVOT_TABLE_2 = `<?xml version="1.0"?>
<pivotTableDefinition xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" name="PivotSales" cacheId="1">
  <location ref="H3:I10" firstHeaderRow="1" firstDataRow="2" firstDataCol="1"/>
  <rowFields count="2"><field x="0"/><field x="1"/></rowFields>
  <colFields count="1"><field x="-2"/></colFields>
  <dataFields count="1"><dataField name="Sum of amount" fld="2" subtotal="sum"/></dataFields>
</pivotTableDefinition>`;

// Rels CROSS the numeric order: table1→cache2, table2→cache1.
const RELS_1 = `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/pivotCacheDefinition" Target="../pivotCache/pivotCacheDefinition2.xml"/>
</Relationships>`;
const RELS_2 = `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/pivotCacheDefinition" Target="../pivotCache/pivotCacheDefinition1.xml"/>
</Relationships>`;

async function makeTwoCacheXlsx(opts: { withRels: boolean }): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const sales = wb.addWorksheet("Sales");
  sales.addRow(["region", "product", "amount"]);
  sales.addRow(["West", "A", 100]);
  sales.addRow(["East", "B", 200]);

  const hr = wb.addWorksheet("HR");
  hr.addRow(["dept", "region", "headcount"]);
  hr.addRow(["Eng", "West", 7]);
  hr.addRow(["Ops", "East", 3]);

  const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  const zip = await JSZip.loadAsync(buf);
  zip.file("xl/pivotTables/pivotTable1.xml", PIVOT_TABLE_1);
  zip.file("xl/pivotTables/pivotTable2.xml", PIVOT_TABLE_2);
  zip.file("xl/pivotCache/pivotCacheDefinition1.xml", CACHE_DEF_1);
  zip.file("xl/pivotCache/pivotCacheDefinition2.xml", CACHE_DEF_2);
  if (opts.withRels) {
    zip.file("xl/pivotTables/_rels/pivotTable1.xml.rels", RELS_1);
    zip.file("xl/pivotTables/_rels/pivotTable2.xml.rels", RELS_2);
  }
  const out = (await zip.generateAsync({ type: "uint8array" })) as Uint8Array;
  return out.slice().buffer;
}

describe("parsePivotsFromXlsx — exact table↔cache pairing (2-cache workbook)", () => {
  it("pairs each pivot table to its cache via rels, even when crossed vs numeric order", async () => {
    const ab = await makeTwoCacheXlsx({ withRels: true });
    const file = { name: "two.xlsx", arrayBuffer: async () => ab };
    const snap = (await parseXlsxToSnapshot(file as unknown as File)) as WorkbookData;
    const pivots = await parsePivotsFromXlsx(ab, snap);

    expect(pivots.length).toBe(2);
    const byValueField = new Map(pivots.map((p) => [p.spec.values[0].field, p]));

    // pivotTable1 (numeric first) must resolve to cache2 = HR (dept/region/headcount).
    const hrPivot = byValueField.get("headcount")!;
    expect(hrPivot).toBeDefined();
    expect(hrPivot.spec.rows).toEqual(["dept", "region"]);
    expect(hrPivot.source.fields).toEqual(["dept", "region", "headcount"]);
    expect(hrPivot.source.rows).toEqual([
      { dept: "Eng", region: "West", headcount: 7 },
      { dept: "Ops", region: "East", headcount: 3 },
    ]);

    // pivotTable2 must resolve to cache1 = Sales (region/product/amount).
    const salesPivot = byValueField.get("amount")!;
    expect(salesPivot).toBeDefined();
    expect(salesPivot.spec.rows).toEqual(["region", "product"]);
    expect(salesPivot.source.fields).toEqual(["region", "product", "amount"]);
    expect(salesPivot.source.rows).toEqual([
      { region: "West", product: "A", amount: 100 },
      { region: "East", product: "B", amount: 200 },
    ]);
  });

  it("falls back to the heuristic (and MIS-pairs) when rels are absent — proving rels are load-bearing", async () => {
    // Without rels, both caches have an in-workbook source + 3 fields, so the
    // heuristic picks the FIRST such cache (cache1/Sales) for BOTH tables. This
    // asserts the pre-fix behaviour to prove the rels test above is meaningful.
    const ab = await makeTwoCacheXlsx({ withRels: false });
    const file = { name: "two.xlsx", arrayBuffer: async () => ab };
    const snap = (await parseXlsxToSnapshot(file as unknown as File)) as WorkbookData;
    const pivots = await parsePivotsFromXlsx(ab, snap);

    expect(pivots.length).toBe(2);
    // Both fall onto cache1 (Sales) → both source-field lists are Sales'.
    for (const p of pivots) {
      expect(p.source.fields).toEqual(["region", "product", "amount"]);
    }
  });
});

describe("parsePivotsFromXlsx — no pivots", () => {
  it("returns [] for a plain workbook", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("S").addRow(["a", "b"]);
    const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    const ab = new Uint8Array(buf).slice().buffer;
    const file = { name: "plain.xlsx", arrayBuffer: async () => ab };
    const snap = (await parseXlsxToSnapshot(file as unknown as File)) as WorkbookData & { pivotsImport?: unknown };
    expect(snap.pivotsImport).toBeUndefined();
    expect(await parsePivotsFromXlsx(ab, snap)).toEqual([]);
  });
});
