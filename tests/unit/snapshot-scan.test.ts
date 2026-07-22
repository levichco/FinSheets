import { describe, expect, it } from "vitest";
import { emptyFormulaCells, findHashCell } from "../../src/core/snapshot-scan";

// Minimal raw Univer snapshot: one sheet, cellData keyed [row][col] = { v, f }.
function snap(cells: Record<number, Record<number, { v?: unknown; f?: string }>>) {
  return { sheetOrder: ["s1"], sheets: { s1: { cellData: cells } } };
}

describe("findHashCell (feature #2 — open at the # cell)", () => {
  it("finds the first cell whose text starts with '#'", () => {
    const s = snap({
      0: { 0: { v: "Header" } },
      2: { 1: { v: "#review here" } },
    });
    expect(findHashCell(s)).toEqual({ row: 2, column: 1 });
  });

  it("ignores Excel error tokens like #REF! / #NAME?", () => {
    const s = snap({ 0: { 0: { v: "#REF!" } }, 1: { 0: { v: "#NAME?" } }, 3: { 2: { v: "#anchor" } } });
    expect(findHashCell(s)).toEqual({ row: 3, column: 2 });
  });

  it("ignores coded IDs like '#123' (only '#', '# note', '#letter' are markers)", () => {
    expect(findHashCell(snap({ 0: { 0: { v: "#123" } }, 1: { 0: { v: "#4A" } } }))).toBeNull();
    expect(findHashCell(snap({ 0: { 0: { v: "#" } } }))).toEqual({ row: 0, column: 0 });
    expect(findHashCell(snap({ 0: { 0: { v: "# note" } } }))).toEqual({ row: 0, column: 0 });
  });

  it("returns null when there is no # marker", () => {
    expect(findHashCell(snap({ 0: { 0: { v: "plain" } } }))).toBeNull();
    expect(findHashCell({})).toBeNull();
  });
});

describe("emptyFormulaCells (feature #12 — recompute only uncached formula cells)", () => {
  it("returns formula cells that have NO cached value", () => {
    const s = snap({
      1: { 0: { f: "=SUM(A1:A3)" } }, // no v → needs compute
      2: { 0: { f: "=SUM(B1:B3)", v: "" } }, // empty string → needs compute
    });
    expect(emptyFormulaCells(s)).toEqual([
      { row: 1, column: 0, formula: "=SUM(A1:A3)" },
      { row: 2, column: 0, formula: "=SUM(B1:B3)" },
    ]);
  });

  it("NEVER includes formula cells with a cached value — including a genuine 0 (the #12 fix)", () => {
    const s = snap({
      1: { 0: { f: "=A1-A2", v: 0 } }, // cached zero total → MUST be preserved, not recomputed
      2: { 0: { f: "=SUM(C1:C9)", v: 1234 } }, // cached non-zero → preserved
      3: { 0: { v: 5 } }, // plain value, no formula
    });
    expect(emptyFormulaCells(s)).toEqual([]);
  });
});
