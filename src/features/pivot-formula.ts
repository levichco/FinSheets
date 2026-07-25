/**
 * A tiny, SAFE arithmetic evaluator for pivot "calculated fields" (custom-formula value fields).
 * Supports + - * / ( ), unary minus, numeric constants, a comparison layer (= <> > >= < <=,
 * returning 1/0), a safe scalar FUNCTION set, and bare identifiers that resolve to other value
 * fields' aggregated results (via the `vars` resolver). No `eval`/`Function` — a hand-rolled
 * recursive-descent parser + a static function table, so an arbitrary formula string can never
 * execute code.
 *
 * Example: values "Amount" (SUM) and "Orders" (COUNTA) → calculated field `ROUND(Amount / Orders, 2)`
 * gives a 2-dp average per order. Identifiers may be bare (`Amount`) or single-quoted for names
 * with spaces (`'Total Price' / Quantity`).
 */
export type FormulaVars = (name: string) => number | undefined;

/** Round half-AWAY-from-zero to `d` decimals, matching Google Sheets / Excel ROUND. */
function roundTo(x: number, d: number): number {
  const f = Math.pow(10, d);
  return (x < 0 ? -1 : 1) * Math.round(Math.abs(x) * f) / f;
}

/** Safe scalar function table (all pure + deterministic). A NaN arg propagates; wrong arity → NaN. */
const FUNCTIONS: Record<string, (a: number[]) => number> = {
  ABS: (a) => (a.length === 1 ? Math.abs(a[0]) : NaN),
  ROUND: (a) => (a.length === 1 ? roundTo(a[0], 0) : a.length === 2 ? roundTo(a[0], a[1]) : NaN),
  ROUNDUP: (a) => {
    if (a.length < 1 || a.length > 2) return NaN;
    const d = a.length === 2 ? a[1] : 0;
    const f = Math.pow(10, d);
    return (a[0] < 0 ? -1 : 1) * Math.ceil(Math.abs(a[0]) * f) / f;
  },
  ROUNDDOWN: (a) => {
    if (a.length < 1 || a.length > 2) return NaN;
    const d = a.length === 2 ? a[1] : 0;
    const f = Math.pow(10, d);
    return (a[0] < 0 ? -1 : 1) * Math.floor(Math.abs(a[0]) * f) / f;
  },
  INT: (a) => (a.length === 1 ? Math.floor(a[0]) : NaN),
  CEILING: (a) => {
    if (a.length < 1 || a.length > 2) return NaN;
    const sig = a.length === 2 ? a[1] : 1;
    return sig === 0 ? 0 : Math.ceil(a[0] / sig) * sig;
  },
  FLOOR: (a) => {
    if (a.length < 1 || a.length > 2) return NaN;
    const sig = a.length === 2 ? a[1] : 1;
    return sig === 0 ? 0 : Math.floor(a[0] / sig) * sig;
  },
  MIN: (a) => (a.length ? Math.min(...a) : NaN),
  MAX: (a) => (a.length ? Math.max(...a) : NaN),
  SQRT: (a) => (a.length === 1 ? Math.sqrt(a[0]) : NaN),
  POWER: (a) => (a.length === 2 ? Math.pow(a[0], a[1]) : NaN),
  MOD: (a) => (a.length === 2 && a[1] !== 0 ? a[0] - a[1] * Math.floor(a[0] / a[1]) : NaN), // sign follows divisor (Excel)
  SIGN: (a) => (a.length === 1 ? Math.sign(a[0]) : NaN),
  IF: (a) => (a.length === 3 ? (a[0] !== 0 ? a[1] : a[2]) : NaN), // IF(cond, then, else)
};

/** Field/identifier names referenced by a formula — EXCLUDING function names + comparison keywords,
 *  so the dependency graph binds only real value fields (e.g. `ABS(Amount)` refs Amount, not ABS). */
export function formulaRefs(formula: string): string[] {
  const refs = new Set<string>();
  const re = /'([^']+)'|([A-Za-z_][A-Za-z0-9_ ]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(formula)) !== null) {
    const quoted = m[1] != null;
    const name = (m[1] ?? m[2] ?? "").trim();
    if (!name) continue;
    // A bare token immediately followed by "(" is a function call, not a field reference.
    if (!quoted) {
      let j = re.lastIndex;
      while (j < formula.length && (formula[j] === " " || formula[j] === "\t")) j++;
      if (formula[j] === "(") continue;
      if (FUNCTIONS[name.toUpperCase()]) continue;
    }
    refs.add(name);
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
  // cmp := addSub (('=' | '<>' | '>' | '>=' | '<' | '<=') addSub)?  — single, non-chained; 1/0.
  const cmp = (): number => {
    const l = addSub();
    ws();
    // Two-char operators MUST be matched before the single-char ones.
    let op: string | null = null;
    if (s.startsWith("<>", i) || s.startsWith(">=", i) || s.startsWith("<=", i)) {
      op = s.slice(i, i + 2);
      i += 2;
    } else if (s[i] === "=" || s[i] === ">" || s[i] === "<") {
      op = s[i];
      i += 1;
    }
    if (op == null) return l;
    const r = addSub();
    switch (op) {
      case "=":
        return l === r ? 1 : 0;
      case "<>":
        return l !== r ? 1 : 0;
      case ">":
        return l > r ? 1 : 0;
      case ">=":
        return l >= r ? 1 : 0;
      case "<":
        return l < r ? 1 : 0;
      case "<=":
        return l <= r ? 1 : 0;
      default:
        return NaN;
    }
  };
  // addSub := term (('+' | '-') term)*
  const addSub = (): number => {
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
  // factor := number | funcCall | ident | '(' cmp ')' | ('-'|'+') factor
  const factor = (): number => {
    ws();
    if (i >= s.length) return NaN;
    const ch = s[i];
    if (ch === "(") {
      i++;
      const v = cmp();
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
    // quoted identifier (never a function call)
    if (ch === "'") {
      const end = s.indexOf("'", i + 1);
      if (end < 0) return NaN;
      const name = s.slice(i + 1, end);
      i = end + 1;
      return vars(name) ?? NaN;
    }
    // bare identifier — either a function call `NAME(args)` or a field reference.
    const id = /^[A-Za-z_][A-Za-z0-9_]*(?: [A-Za-z0-9_]+)*/.exec(s.slice(i));
    if (id) {
      const name = id[0].trim();
      i += id[0].length;
      ws();
      if (s[i] === "(") {
        const fn = FUNCTIONS[name.toUpperCase()];
        i++; // consume "("
        const args: number[] = [];
        ws();
        if (s[i] !== ")") {
          args.push(cmp());
          ws();
          while (s[i] === ",") {
            i++;
            args.push(cmp());
            ws();
          }
        }
        if (s[i] === ")") i++;
        else return NaN; // unterminated call
        if (!fn) return NaN; // unknown function
        return fn(args);
      }
      return vars(name) ?? NaN;
    }
    return NaN;
  };
  const result = cmp();
  ws();
  return i === s.length ? result : NaN; // trailing garbage → error
}
