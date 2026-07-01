/**
 * FinOpz-styled Find & Replace — a right-side drawer (like Univer's panel).
 * Finds/replaces by reading the live snapshot and writing via the Facade API.
 * On Find it highlights ALL matches with a yellow background and selects the
 * current one (selection border) for identification; navigating moves the
 * border. Highlights are restored when the search changes or the panel closes,
 * so they never persist into the data. UI-only; the engine is unchanged.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, X } from "@untitledui/icons";
import type { UniverAPI } from "../core/create-sheet";
import { Button, ConfirmModal } from "./modal";

/* ---- Loose Facade views --------------------------------------------------- */
interface CellStyle {
  bg?: { rgb?: string };
}
interface SnapCell {
  v?: unknown;
  s?: string | CellStyle;
}
interface FRange {
  activate(): unknown;
  setValue(v: string | number): unknown;
  setBackground(color: string): unknown;
}
interface FSheet {
  getRange(row: number, column: number): FRange;
  scrollToCell(row: number, column: number): unknown;
}
interface FSnapshot {
  sheetOrder?: string[];
  sheets?: Record<string, { cellData?: Record<number, Record<number, SnapCell>> }>;
  styles?: Record<string, CellStyle | undefined>;
}
interface FWorkbook {
  getActiveSheet(): FSheet | null;
  getSnapshot(): FSnapshot;
}
interface FindApi {
  getActiveWorkbook(): FWorkbook | null;
}

interface Match {
  row: number;
  col: number;
}
interface Highlighted {
  row: number;
  col: number;
  orig: string;
}

const HIGHLIGHT = "#fff3a0"; // light yellow, like a find highlight
const DEFAULT_BG = "#ffffff";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function cellText(v: unknown): string {
  return v === undefined || v === null ? "" : String(v);
}

const drawer: CSSProperties = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  width: 340,
  background: "#fff",
  borderLeft: "1px solid #eaecf0",
  boxShadow: "-8px 0 24px rgba(16,24,40,0.08)",
  display: "flex",
  flexDirection: "column",
  zIndex: 50,
};
const labelStyle: CSSProperties = { fontSize: 13, fontWeight: 500, color: "#344054", margin: "14px 0 6px", display: "block" };
const inputStyle: CSSProperties = { width: "100%", height: 38, borderRadius: 8, border: "1px solid #d0d5dd", padding: "0 12px", fontSize: 14, boxSizing: "border-box", outline: "none" };
const checkRow: CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#475467", cursor: "pointer" };
const checkbox: CSSProperties = { accentColor: "#0a0a0a", width: 15, height: 15, cursor: "pointer" };
const navBtn: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, border: "1px solid #d0d5dd", background: "#fff", color: "#475467", cursor: "pointer", flexShrink: 0 };

export interface FindReplaceModalProps {
  api: UniverAPI | null;
  open: boolean;
  onClose: () => void;
}

export function FindReplaceModal({ api, open, onClose }: FindReplaceModalProps) {
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeCell, setWholeCell] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [idx, setIdx] = useState(-1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const highlightsRef = useRef<Highlighted[]>([]);

  const apiOf = () => api as unknown as FindApi | null;
  const sheet = () => apiOf()?.getActiveWorkbook()?.getActiveSheet() ?? null;
  const snapshot = () => apiOf()?.getActiveWorkbook()?.getSnapshot();

  const test = useMemo(() => {
    if (!find) return () => false;
    if (wholeCell) return (text: string) => (caseSensitive ? text === find : text.toLowerCase() === find.toLowerCase());
    const needle = caseSensitive ? find : find.toLowerCase();
    return (text: string) => (caseSensitive ? text : text.toLowerCase()).includes(needle);
  }, [find, caseSensitive, wholeCell]);

  const cellsOf = (snap: FSnapshot | undefined): Record<number, Record<number, SnapCell>> => {
    const sheetId = snap?.sheetOrder?.[0] ?? (snap?.sheets ? Object.keys(snap.sheets)[0] : undefined);
    return (sheetId && snap?.sheets?.[sheetId]?.cellData) || {};
  };

  const collect = (): Match[] => {
    if (!find) return [];
    const cellData = cellsOf(snapshot());
    const out: Match[] = [];
    for (const [r, cols] of Object.entries(cellData)) {
      for (const [c, cell] of Object.entries(cols ?? {})) {
        if (cell && test(cellText(cell.v))) out.push({ row: Number(r), col: Number(c) });
      }
    }
    out.sort((a, b) => a.row - b.row || a.col - b.col);
    return out;
  };

  const bgOf = (snap: FSnapshot | undefined, cell: SnapCell | undefined): string => {
    if (!cell) return DEFAULT_BG;
    const style = typeof cell.s === "string" ? snap?.styles?.[cell.s] : cell.s;
    return style?.bg?.rgb ?? DEFAULT_BG;
  };

  const clearHighlights = () => {
    const s = sheet();
    for (const h of highlightsRef.current) {
      try {
        s?.getRange(h.row, h.col).setBackground(h.orig);
      } catch {
        /* ignore */
      }
    }
    highlightsRef.current = [];
  };

  const applyHighlights = (ms: Match[]) => {
    clearHighlights(); // restore any previous highlights first (so origs are read clean)
    const s = sheet();
    if (!s || !ms.length) return;
    const snap = snapshot();
    const cellData = cellsOf(snap);
    const next: Highlighted[] = [];
    for (const m of ms) {
      const orig = bgOf(snap, cellData[m.row]?.[m.col]);
      try {
        s.getRange(m.row, m.col).setBackground(HIGHLIGHT);
        next.push({ row: m.row, col: m.col, orig });
      } catch {
        /* ignore */
      }
    }
    highlightsRef.current = next;
  };

  const activateOne = (m: Match | undefined) => {
    if (!m) return;
    const s = sheet();
    s?.getRange(m.row, m.col).activate(); // selection border on the current match
    s?.scrollToCell(m.row, m.col); // bring it into view
  };

  const doFind = () => {
    const found = collect();
    setMatches(found);
    setIdx(found.length ? 0 : -1);
    applyHighlights(found);
    activateOne(found[0]); // selection border on the current match
  };

  const step = (dir: number) => {
    if (!matches.length) return doFind();
    const next = (idx + dir + matches.length) % matches.length;
    setIdx(next);
    activateOne(matches[next]);
  };

  const replaceOne = (text: string): string => {
    if (wholeCell) return replace;
    return caseSensitive ? text.split(find).join(replace) : text.replace(new RegExp(escapeRegExp(find), "gi"), replace);
  };

  const replaceCurrent = () => {
    if (idx < 0 || !matches[idx] || !find) return;
    const m = matches[idx];
    const cur = cellText(cellsOf(snapshot())[m.row]?.[m.col]?.v);
    clearHighlights();
    sheet()?.getRange(m.row, m.col).setValue(replaceOne(cur));
    const found = collect();
    setMatches(found);
    const next = found.length ? Math.min(idx, found.length - 1) : -1;
    setIdx(next);
    applyHighlights(found);
    activateOne(found[next]);
  };

  const replaceAll = () => {
    if (!find) return;
    clearHighlights();
    const cellData = cellsOf(snapshot());
    const s = sheet();
    for (const m of collect()) {
      s?.getRange(m.row, m.col).setValue(replaceOne(cellText(cellData[m.row]?.[m.col]?.v)));
    }
    setMatches([]);
    setIdx(-1);
  };

  // Restore highlights whenever the query/options change.
  useEffect(() => {
    clearHighlights();
    setMatches([]);
    setIdx(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [find, caseSensitive, wholeCell]);

  // Restore highlights + clear match state when the panel closes (so a reopen
  // doesn't show a stale "N of M" with no on-sheet highlight).
  useEffect(() => {
    if (!open) {
      clearHighlights();
      setMatches([]);
      setIdx(-1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  const counter = find ? (matches.length ? `${idx + 1} of ${matches.length}` : "No results") : "";

  return (
    <>
      <aside style={drawer} role="dialog" aria-label="Find and replace">
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 6px" }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#101828" }}>Find and replace</span>
          <button type="button" aria-label="Close" onClick={onClose} style={{ ...navBtn, border: "none" }}>
            <X size={18} />
          </button>
        </header>

        <div style={{ padding: "0 16px 16px", overflowY: "auto" }}>
          <label style={labelStyle}>Find</label>
          <input
            autoFocus
            style={inputStyle}
            placeholder="Find in this sheet"
            value={find}
            onChange={(e) => setFind(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doFind()}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 12, color: "#667085" }}>{counter}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" aria-label="Previous" style={navBtn} onClick={() => step(-1)} disabled={!matches.length}>
                <ChevronLeft size={16} />
              </button>
              <button type="button" aria-label="Next" style={navBtn} onClick={() => step(1)} disabled={!matches.length}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <label style={labelStyle}>Replace with</label>
          <input style={inputStyle} placeholder="Replacement" value={replace} onChange={(e) => setReplace(e.target.value)} />

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            <label style={checkRow}>
              <input type="checkbox" style={checkbox} checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} /> Case sensitive
            </label>
            <label style={checkRow}>
              <input type="checkbox" style={checkbox} checked={wholeCell} onChange={(e) => setWholeCell(e.target.checked)} /> Match entire cell
            </label>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <Button variant="primary" onClick={doFind} disabled={!find}>
              Find
            </Button>
            <Button variant="secondary" onClick={replaceCurrent} disabled={idx < 0}>
              Replace
            </Button>
            <Button variant="secondary" onClick={() => setConfirmOpen(true)} disabled={!find}>
              Replace all
            </Button>
          </div>
        </div>
      </aside>

      <ConfirmModal
        open={confirmOpen}
        title="Replace all matches?"
        message={`This will replace every match of "${find}" in the sheet.`}
        confirmLabel="Replace all"
        onConfirm={replaceAll}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}

export default FindReplaceModal;
