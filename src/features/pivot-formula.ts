/**
 * A tiny, SAFE arithmetic evaluator for pivot "calculated fields" (custom-formula value fields).
 * Supports + - * / ( ), unary minus, numbers, and bare identifiers that resolve to other value
 * fields' aggregated results (via the `vars` resolver). No `eval`/`Function` — a hand-rolled
 * recursive-descent parser, so an arbitrary formula string can never execute code.
 *
 * Example: a pivot with values "Amount" (SUM) and "Orders" (COUNTA) can add a calculated field
 * with formula `Amount / Orders` to get an average per order. Identifiers may be bare
 * (`Amount`) or wrapped in single quotes for names with spaces (`'Total Price' / Quantity`).
 */
export type FormulaVars = (name: string) => number | undefined;

/** Field/identifier names referenced by a formula (bare or single-quoted). */
export function formulaRefs(formula: string): string[] {
  const refs = new Set<string>();
  const re = /'([^']+)'|([A-Za-z_][A-Za-z0-9_ ]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(formula)) !== null) {
    const name = (m[1] ?? m[2] ?? "").trim();
    if (name) refs.add(name);
  }
  return [...refs];
}

/** Evaluate `formula` with identifiers resolved by `vars`. Returns NaN on a parse/reference error. */
export function evalFormula(formula: string, vars: FormulaVars): number {
  let i = 0;
  const s = formula;
  const ws = () => {
    while (i < s.length && (s[i] === " " || s[i] === "\t")) i++;
  };
  // expr := term (('+' | '-') term)*
  const expr = (): number => {
    let v = term();
    ws();
    while (i < s.length && (s[i] === "+" || s[i] === "-")) {
      const op = s[i++];
      const r = term();
      v = op === "+" ? v + r : v - r;
      ws();
    }
    return v;
  };
  // term := factor (('*' | '/') factor)*
  const term = (): number => {
    let v = factor();
    ws();
    while (i < s.length && (s[i] === "*" || s[i] === "/")) {
      const op = s[i++];
      const r = factor();
      v = op === "*" ? v * r : r === 0 ? NaN : v / r;
      ws();
    }
    return v;
  };
  // factor := number | ident | '(' expr ')' | '-' factor
  const factor = (): number => {
    ws();
    if (i >= s.length) return NaN;
    const ch = s[i];
    if (ch === "(") {
      i++;
      const v = expr();
      ws();
      if (s[i] === ")") i++;
      return v;
    }
    if (ch === "-") {
      i++;
      return -factor();
    }
    if (ch === "+") {
      i++;
      return factor();
    }
    // number
    const num = /^[0-9]*\.?[0-9]+/.exec(s.slice(i));
    if (num) {
      i += num[0].length;
      return Number(num[0]);
    }
    // quoted identifier
    if (ch === "'") {
      const end = s.indexOf("'", i + 1);
      if (end < 0) return NaN;
      const name = s.slice(i + 1, end);
      i = end + 1;
      return vars(name) ?? NaN;
    }
    // bare identifier (letters, digits, underscores, spaces up to an operator/paren)
    const id = /^[A-Za-z_][A-Za-z0-9_]*(?: [A-Za-z0-9_]+)*/.exec(s.slice(i));
    if (id) {
      i += id[0].length;
      return vars(id[0].trim()) ?? NaN;
    }
    return NaN;
  };
  const result = expr();
  ws();
  return i === s.length ? result : NaN; // trailing garbage → error
}
