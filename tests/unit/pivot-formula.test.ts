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

  describe("Wave 2 — functions + comparisons", () => {
    it("evaluates the scalar function set", () => {
      expect(evalFormula("ABS(-5)", vars)).toBe(5);
      expect(evalFormula("ROUND(3.14159, 2)", vars)).toBe(3.14);
      expect(evalFormula("ROUND(2.5)", vars)).toBe(3); // half away from zero
      expect(evalFormula("ROUND(-2.5)", vars)).toBe(-3);
      expect(evalFormula("MIN(3, 7, 2)", vars)).toBe(2);
      expect(evalFormula("MAX(3, 7, 2)", vars)).toBe(7);
      expect(evalFormula("SQRT(16)", vars)).toBe(4);
      expect(evalFormula("POWER(2, 10)", vars)).toBe(1024);
      expect(evalFormula("MOD(10, 3)", vars)).toBe(1);
      expect(evalFormula("INT(3.9)", vars)).toBe(3);
      expect(evalFormula("SIGN(-8)", vars)).toBe(-1);
      expect(evalFormula("ROUNDUP(1.01, 1)", vars)).toBe(1.1);
      expect(evalFormula("ROUNDDOWN(1.99, 1)", vars)).toBe(1.9);
    });
    it("functions compose with fields + arithmetic", () => {
      expect(evalFormula("ROUND(Amount / Orders, 1)", vars)).toBe(25); // 100/4
      expect(evalFormula("MAX(Amount, 200)", vars)).toBe(200);
      expect(evalFormula("ABS(Orders - Amount)", vars)).toBe(96);
    });
    it("comparisons return 1/0 and drive IF", () => {
      expect(evalFormula("Amount > 50", vars)).toBe(1);
      expect(evalFormula("Amount < 50", vars)).toBe(0);
      expect(evalFormula("Orders = 4", vars)).toBe(1);
      expect(evalFormula("Orders <> 4", vars)).toBe(0);
      expect(evalFormula("IF(Amount > 50, 1, -1)", vars)).toBe(1);
      expect(evalFormula("IF(Amount < 50, 1, -1)", vars)).toBe(-1);
      expect(evalFormula("IF(Amount >= 100, Amount * 2, 0)", vars)).toBe(200);
    });
    it("pure-constant and function-of-constants formulas evaluate (no field refs)", () => {
      expect(evalFormula("100", vars)).toBe(100);
      expect(evalFormula("ROUND(3.14159, 2)", vars)).toBe(3.14);
      expect(formulaRefs("ROUND(3.14159, 2)")).toEqual([]); // no field refs
      expect(formulaRefs("ABS(Amount) + 1")).toEqual(["Amount"]); // ABS not treated as a field
    });
    it("unknown function / wrong arity → NaN", () => {
      expect(Number.isNaN(evalFormula("BOGUS(1)", vars))).toBe(true);
      expect(Number.isNaN(evalFormula("SQRT(1, 2)", vars))).toBe(true);
      expect(Number.isNaN(evalFormula("IF(1, 2)", vars))).toBe(true);
    });
  });
});
