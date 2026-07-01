import { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { LevichSheet, LEVICH_BRAND, type ColumnDef, type LevichSheetHandle, type SheetData } from "../src";
import { takeImportPayload, takeSnapshotPayload } from "../src/core/import-data";

// "Create new spreadsheet" / "Replace spreadsheet" (import) opens this URL in a
// new tab (or reloads) and stashes the imported workbook. Rich .xlsx imports
// carry a full Univer snapshot (styles / merges / formats / all sheets); CSV or
// a failed parse falls back to a flat grid. Whichever is present becomes the
// initial document instead of a blank sheet.
const IMPORT_SNAPSHOT = takeSnapshotPayload<Record<string, unknown>>();
const IMPORT_PAYLOAD = IMPORT_SNAPSHOT ? null : takeImportPayload();

/** Count the visible sheets in an imported snapshot (hidden ones exist but
 *  aren't shown as tabs — matches the source app). */
function visibleSheetCount(snap: Record<string, unknown>): number {
  const sheets = (snap.sheets as Record<string, { hidden?: number }> | undefined) ?? {};
  const list = Object.values(sheets);
  const visible = list.filter((s) => s.hidden !== 1).length;
  return visible || list.length || 1;
}
function gridToSheet(grid: (string | number)[][]): { columns: ColumnDef[]; data: SheetData } {
  const headers = grid[0] ?? [];
  const columns: ColumnDef[] = headers.map((h, i) => ({ key: `c${i}`, header: String(h ?? `Column ${i + 1}`), editable: true, width: 150 }));
  const data: SheetData = grid.slice(1).map((row) => {
    const o: Record<string, string | number> = {};
    columns.forEach((c, i) => (o[c.key] = row[i] ?? ""));
    return o;
  });
  return { columns, data };
}

// A fresh, EMPTY spreadsheet (no dummy data): blank, unheaded columns so the
// grid opens like a new Google Sheet. Import or typing fills it in.
const BLANK_COLUMNS: ColumnDef[] = Array.from({ length: 12 }, (_, i) => ({ key: `c${i}`, header: "", editable: true, width: 120 }));
const BLANK_DATA: SheetData = [];

document.title = "Untitled spreadsheet - FinOpz Sheets";

/** Official FinOpz brand logo (gold mark + wordmark). */
function FinOpzLogo() {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }} aria-label="FinOpz" role="img">
      <svg width="24" height="24" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M20.1172 19.7521C20.1172 19.9541 19.9534 20.1179 19.7514 20.1179H13.7772C13.5752 20.1179 13.4114 19.9541 13.4114 19.7521V13.4121H20.1172V19.7521Z" fill="#EFC71D" />
        <path d="M20.1172 6.70576H13.4114V4.76837e-07H19.7514C19.9534 4.76837e-07 20.1172 0.163761 20.1172 0.365769V6.70576Z" fill="#EFC71D" />
        <rect x="13.4121" y="6.70576" width="6.70576" height="6.70576" transform="rotate(180 13.4121 6.70576)" fill="#EFC71D" />
        <path d="M6.70508 6.70576H0.365085C0.163076 6.70576 -0.000684261 6.542 -0.000684261 6.33999V0.365769C-0.000684261 0.163761 0.163076 4.76837e-07 0.365085 4.76837e-07H6.70508V6.70576Z" fill="#EFC71D" />
        <rect x="20.1172" y="13.4108" width="6.70576" height="6.70576" transform="rotate(180 20.1172 13.4108)" fill="#EFC71D" />
        <path d="M13.4121 13.4108H7.07212C6.87011 13.4108 6.70635 13.2471 6.70635 13.0451V6.70508H13.4121V13.4108Z" fill="#EFC71D" />
        <rect x="6.70508" y="20.1179" width="6.70576" height="6.70576" rx="0.365769" transform="rotate(180 6.70508 20.1179)" fill="#EFC71D" />
      </svg>
      <span
        style={{
          fontFamily: "'Work Sans', ui-sans-serif, system-ui, sans-serif",
          fontSize: 22,
          lineHeight: 1,
          fontWeight: 400,
          letterSpacing: "-0.66px",
          color: "#313131",
        }}
      >
        FinOpz
      </span>
    </div>
  );
}

function App() {
  const ref = useRef<LevichSheetHandle>(null);
  const [note, setNote] = useState("");
  const [closed, setClosed] = useState(false);

  const imported = useMemo(() => (IMPORT_PAYLOAD ? gridToSheet(IMPORT_PAYLOAD) : null), []);
  const data = imported ? imported.data : BLANK_DATA;
  const columns = imported ? imported.columns : BLANK_COLUMNS;

  const download = async () => {
    const n = (await ref.current?.exportXlsx("levich-demo.xlsx")) ?? 0;
    setNote(n ? `Exported ${n} rows to .xlsx` : "Sheet not ready yet");
  };

  if (closed) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100vh", color: "#667085" }}>
        <button
          onClick={() => setClosed(false)}
          style={{ padding: "10px 18px", borderRadius: 8, border: `1px solid ${LEVICH_BRAND}`, background: "#fff", color: LEVICH_BRAND, fontWeight: 600, cursor: "pointer" }}
        >
          Reopen Levich Sheet
        </button>
      </div>
    );
  }

  const title = IMPORT_SNAPSHOT ? "Imported workbook" : imported ? "Imported spreadsheet" : "Untitled spreadsheet";
  const subtitle = IMPORT_SNAPSHOT ? `${visibleSheetCount(IMPORT_SNAPSHOT)} sheet(s) · rich import` : imported ? `${data.length} rows imported` : "Blank spreadsheet";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "10px 20px",
          borderBottom: "1px solid #e4e7ec",
          background: "#fff",
        }}
      >
        <FinOpzLogo />

        <div style={{ width: 1, height: 28, background: "#e4e7ec" }} />

        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#101828" }}>{title}</span>
          <span style={{ fontSize: 12, color: "#667085" }}>{subtitle}</span>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          {note && <span style={{ color: "#067647", fontSize: 13, fontWeight: 500 }}>{note}</span>}

          <button
            onClick={download}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#000")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#101828")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "#101828",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              boxShadow: "0 1px 2px rgba(16,24,40,0.05)",
              cursor: "pointer",
              transition: "background-color 0.15s ease",
            }}
          >
            Download .xlsx
          </button>

          <button
            onClick={() => setClosed(true)}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: "#667085",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0 }}>
        <LevichSheet
          ref={ref}
          data={data}
          columns={columns}
          snapshot={IMPORT_SNAPSHOT ?? undefined}
          freeze={imported ? { rows: 1 } : false}
          currencySymbol="$"
          // Real-world routing: document-level imports (create / replace a whole
          // document) are owned by the FinOpz backend. In PRODUCTION you'd POST/
          // PUT to your API and `return true` so the sheet skips its built-in
          // behavior. On THIS demo there's no backend, so we only log where that
          // call would go and `return false` — letting the sheet's built-in
          // behavior run (new tab / clear+write) so it still works on localhost.
          onImport={(grid, location) => {
            if (location === "new-spreadsheet" || location === "replace-spreadsheet") {
              // PROD: await fetch("/api/spreadsheets", { method: location === "new-spreadsheet" ? "POST" : "PUT", body: JSON.stringify(grid) }); return true;
              console.log(`[FinOpz BE] would ${location} — ${grid.length} rows (no backend on localhost → using built-in behavior)`);
            }
            return false; // demo: always use the sheet's built-in local behavior
          }}
        />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
