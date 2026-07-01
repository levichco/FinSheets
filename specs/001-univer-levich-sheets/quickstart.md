# Quickstart: `@levich/univer-sheets`

## For consumers (e.g. fiab-ui)

**1. Install (local link during dev)**
```jsonc
// fiab-ui/app/package.json
"dependencies": {
  "@levich/univer-sheets": "file:../../../Univer_Levich"
}
```
```jsonc
// fiab-ui/app/vite.config.ts — ensure ONE React instance
resolve: { dedupe: ["react", "react-dom"] }
```

**2. Render a general sheet**
```tsx
import { LevichSheet } from "@levich/univer-sheets";
import "@levich/univer-sheets/styles.css";
import { useRef } from "react";
import type { LevichSheetHandle } from "@levich/univer-sheets";

function Demo() {
  const ref = useRef<LevichSheetHandle>(null);
  return (
    <>
      <button onClick={() => ref.current?.exportXlsx("export.xlsx")}>Download .xlsx</button>
      <LevichSheet
        ref={ref}
        data={rows}
        columns={[
          { key: "date",   header: "Date",   format: "date" },
          { key: "amount", header: "Amount", format: "currency", locked: true },
          { key: "note",   header: "Note",   editable: true },
        ]}
        freeze={{ rows: 1 }}
        onCellEdit={(e) => persist(e)}
      />
    </>
  );
}
```

**3. Or use the transaction preset**
```tsx
import { TransactionSheet } from "@levich/univer-sheets";
<TransactionSheet rows={txns} currencySymbol="$" subsidiaryId={sid} accountId={aid} />
```

**4. Pivot (optional)**
```tsx
<LevichSheet data={rows} columns={cols}
  pivot={{ rows: ["type"], columns: ["entity"], values: ["amount"], aggregate: "sum" }} />
```

The downloaded `.xlsx` contains **everything on screen** — edits, comments, colors,
currency/date formats, borders, merged cells, widths, frozen header.

## For package developers

```bash
cd Univer_Levich
npm install
npm run build      # tsup → dist/ (ESM + .d.ts + styles.css)
npm run test       # vitest: unit + fidelity (re-open exported .xlsx, assert styles)
npm run dev        # watch build while linked into fiab-ui
```

**Release / rollback**
```bash
# bump @univerjs/* exact pin → npm run build → npm run test → record engine version
# in CHANGELOG.md → tag e.g. v0.1.0
# rollback: consumer pins the previous version (or checkout the prior tag while linked)
```

## Acceptance smoke test (maps to spec)
1. Embed `<LevichSheet>` with sample data → branded grid renders (US1).
2. Edit a cell + type a comment → click Download → open file → edits + colors present (US2).
3. Add a `pivot` config → pivot region with subtotals + grand total renders (US3).
4. Resize a column / type a note → hooks fire; reload with saved values → restored (US4).
5. Swap to `<TransactionSheet>` → standard branded transaction view (US5).
