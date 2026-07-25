import { describe, expect, it } from "vitest";
import { evalFormula, formulaRefs } from "../../src/features/pivot-formula";

describe("pivot calculated-field formula evaluator (safe, no eval)", () => {
  const vars = (n: string) => ({ Amount: 100, Orders: 4, "Total Price": 250 })[n];
  it("evaluates arithmetic with precedence + parens", () => {
    expect(evalFormula("1 + 2 * 3", vars)).toBe(7);
    expect(evalFormula("(1 + 2) * 3", vars)).toBe(9);
    expect(evalFormula("10 / 4", vars)).toBe(2.5);
    expect(evalFormula("-5 + 3", vars)).toBe(-2);
  });
  it("resolves bare and quoted field identifiers", () => {
    expect(evalFormula("Amount / Orders", vars)).toBe(25);
    expect(evalFormula("'Total Price' / Orders", vars)).toBe(62.5);
  });
  it("returns NaN on divide-by-zero, unknown ref, or garbage", () => {
    expect(Number.isNaN(evalFormula("Amount / 0", vars))).toBe(true);
    expect(Number.isNaN(evalFormula("Nope + 1", vars))).toBe(true);
    expect(Number.isNaN(evalFormula("1 +", vars))).toBe(true);
    expect(Number.isNaN(evalFormula("1 2", vars))).toBe(true);
  });
  it("extracts referenced field names", () => {
    expect(formulaRefs("Amount / Orders").sort()).toEqual(["Amount", "Orders"]);
    expect(formulaRefs("'Total Price' * 2")).toContain("Total Price");
  });
});
