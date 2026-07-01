/**
 * Free-tier print: render the live Univer snapshot as a paginated HTML table in
 * a new window and invoke the browser print dialog. Columns that don't fit a
 * page width flow onto the next page (with the header repeated); numbers print
 * with their on-screen $/% formatting. Shared by the toolbar Print button and
 * the File ▸ Print menu item so there's a single print backend.
 */
export interface PrintCell {
  v?: string | number | boolean | null;
  s?: string | { n?: { pattern?: string } };
}
export interface PrintSnapshot {
  sheetOrder?: string[];
  sheets?: Record<string, { cellData?: Record<number, Record<number, PrintCell>> }>;
  styles?: Record<string, { n?: { pattern?: string } } | undefined>;
}
/** Anything exposing the live snapshot (Univer FWorkbook). */
export interface PrintSource {
  getSnapshot?(): PrintSnapshot;
}

function fmtCell(cell: PrintCell | undefined, styles?: PrintSnapshot["styles"]): string {
  if (!cell || cell.v === undefined || cell.v === null) return "";
  const v = cell.v;
  const style = typeof cell.s === "string" ? styles?.[cell.s] : cell.s;
  const pattern = style?.n?.pattern;
  if (typeof v === "number" && pattern) {
    if (pattern.includes("$")) return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (pattern.includes("%")) return (v * 100).toFixed(2) + "%";
    return v.toLocaleString();
  }
  return String(v);
}

export function printSheet(source: PrintSource | null | undefined): void {
  const snap = source?.getSnapshot?.();
  const sheetId = snap?.sheetOrder?.[0] ?? (snap?.sheets ? Object.keys(snap.sheets)[0] : undefined);
  const cellData = (sheetId && snap?.sheets?.[sheetId]?.cellData) || {};
  let maxRow = -1;
  let maxCol = -1;
  for (const [r, cols] of Object.entries(cellData)) {
    maxRow = Math.max(maxRow, Number(r));
    for (const c of Object.keys(cols ?? {})) maxCol = Math.max(maxCol, Number(c));
  }
  if (maxRow < 0) return;
  const styles = snap?.styles;
  const esc = (s: string) => s.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch]!);

  // Estimate each column's character width, then pack columns into page-groups
  // by a width budget — columns that don't fit flow onto the next page (like
  // Google Sheets) instead of being clipped. Rows paginate vertically with the
  // header repeated (via <thead>).
  const colW: number[] = [];
  for (let c = 0; c <= maxCol; c++) {
    let w = 6;
    for (let r = 0; r <= maxRow; r++) w = Math.max(w, fmtCell(cellData[r]?.[c], styles).length);
    colW[c] = Math.min(w, 36);
  }
  const BUDGET = 92; // approx characters across one portrait page
  const groups: number[][] = [];
  let cur: number[] = [];
  let curW = 0;
  for (let c = 0; c <= maxCol; c++) {
    const cw = colW[c] + 3;
    if (cur.length && curW + cw > BUDGET) {
      groups.push(cur);
      cur = [];
      curW = 0;
    }
    cur.push(c);
    curW += cw;
  }
  if (cur.length) groups.push(cur);

  let body = "";
  groups.forEach((cols, gi) => {
    body += `<table${gi > 0 ? ' class="brk"' : ""}><thead><tr>`;
    for (const c of cols) body += `<th>${esc(fmtCell(cellData[0]?.[c], styles))}</th>`;
    body += "</tr></thead><tbody>";
    for (let r = 1; r <= maxRow; r++) {
      body += "<tr>";
      for (const c of cols) body += `<td>${esc(fmtCell(cellData[r]?.[c], styles))}</td>`;
      body += "</tr>";
    }
    body += "</tbody></table>";
  });

  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(
    `<html><head><title>&nbsp;</title><style>
      @page{margin:0;}
      html,body{margin:0;}
      body{font-family:Arial,sans-serif;padding:14mm;}
      table{border-collapse:collapse;font-size:12px;width:100%;}
      table.brk{page-break-before:always;}
      thead{display:table-header-group;}
      th,td{border:1px solid #d0d5dd;padding:4px 8px;text-align:left;vertical-align:top;word-break:break-word;}
      th{background:#f9fafb;font-weight:700;}
    </style></head><body>${body}</body></html>`,
  );
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
  }, 200);
}
