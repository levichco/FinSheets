/**
 * Lazy-sheet PoC (localhost:9100/?poc).
 *
 * Simulates the target architecture ENTIRELY on the FE, with no real backend:
 *   - The whole .xlsx was converted to Univer JSON on the "backend"
 *     (scripts/xlsx-poc.mjs, running the real parseXlsxToSnapshot in Node) and
 *     split into one file per sheet: public/poc-sheets/<sheetId>.json, plus a
 *     manifest of the 69 tabs: public/poc-manifest.json.
 *   - This component loads ONLY the manifest + the active sheet. Other sheets
 *     are fetched on tab-click and cached, so re-visits are instant.
 *
 * This is the "open a 69-sheet, 5.5 MB workbook instantly; tabs load on demand"
 * experience — the thing that used to freeze the tab. The real backend is just
 * moving xlsx-poc.mjs behind POST /import + GET /documents/:id/sheets/:sheetId.
 */
import { useEffect, useRef, useState } from "react";
import { LevichSheet, type ColumnDef, type SheetData } from "../src";
import "../src/theme/office-fonts.css"; // alias Calibri→Carlito etc. so text isn't serif

interface SheetMeta {
  order: number;
  sheetId: string;
  name: string;
  hidden: number;
}

type Snapshot = Record<string, unknown>;

// STABLE references — LevichSheet has `data`/`columns` in its effect deps, so
// inline `[]` literals would make it tear down & recreate Univer every render
// (an infinite dispose/recreate loop). Snapshot mode ignores their contents.
const NO_DATA: SheetData = [];
const NO_COLUMNS: ColumnDef[] = [];

export function PocApp() {
  const [manifest, setManifest] = useState<SheetMeta[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Wait for the Office-substitute fonts to load, then re-render (canvas doesn't
  // reflow on late font load) so Calibri/Arial text renders correctly, not serif.
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    const wanted = ['16px Calibri', 'bold 16px Calibri', 'italic 16px Calibri', '16px Arial', 'bold 16px Arial', '16px "Times New Roman"', '16px Cambria'];
    const done = setTimeout(() => setFontsReady(true), 1500); // fallback so it never hangs
    Promise.all(wanted.map((f) => (document.fonts?.load(f) ?? Promise.resolve()).catch(() => {}))).then(() => { clearTimeout(done); setFontsReady(true); });
    return () => clearTimeout(done);
  }, []);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [note, setNote] = useState("Loading manifest…");
  const cache = useRef(new Map<string, Snapshot>());
  const renderT0 = useRef(0);
  const lastFetch = useRef<{ fetchMs: number; kb: number; cached: boolean }>({ fetchMs: 0, kb: 0, cached: false });

  // 1) Load the manifest (the tab list) — tiny.
  useEffect(() => {
    void (async () => {
      const t0 = performance.now();
      const m: SheetMeta[] = await (await fetch("/poc-manifest.json")).json();
      setManifest(m);
      setNote(`Manifest: ${m.length} sheets in ${Math.round(performance.now() - t0)}ms — pick a tab`);
      const first = m.find((s) => !s.hidden && !s.name.includes(">>>")) ?? m.find((s) => !s.hidden) ?? m[0];
      if (first) setActiveId(first.sheetId);
    })();
  }, []);

  // 2) Load the active sheet (cache-aware).
  useEffect(() => {
    if (!activeId) return;
    const cached = cache.current.get(activeId);
    if (cached) {
      lastFetch.current = { fetchMs: 0, kb: 0, cached: true };
      renderT0.current = performance.now();
      setSnap(cached);
      return;
    }
    const t0 = performance.now();
    void (async () => {
      const text = await (await fetch(`/poc-sheets/${activeId}.json`)).text();
      const json = JSON.parse(text) as Snapshot;
      cache.current.set(activeId, json);
      lastFetch.current = { fetchMs: Math.round(performance.now() - t0), kb: Math.round(text.length / 1024), cached: false };
      renderT0.current = performance.now();
      setSnap(json); // re-render also repaints the tab strip (this tab now cached)
    })();
  }, [activeId]);

  const activeName = manifest?.find((s) => s.sheetId === activeId)?.name ?? "";
  const tabs = (manifest ?? []).filter((s) => !s.hidden);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "'Work Sans', system-ui, sans-serif" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 20px", borderBottom: "1px solid #e4e7ec", background: "#fff" }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#101828" }}>FinOpz — Lazy Sheets PoC</span>
        <span style={{ fontSize: 12, color: "#667085" }}>{manifest ? `${manifest.length} sheets · load-on-click · cached: ${cache.current.size}` : ""}</span>
        <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 500, color: "#067647" }}>{note}</span>
      </header>

      {/* Tab strip — all sheets from the manifest; data loads only on click. */}
      <div style={{ display: "flex", gap: 4, padding: "6px 12px", overflowX: "auto", borderBottom: "1px solid #eaecf0", background: "#fafafa", whiteSpace: "nowrap" }}>
        {tabs.map((s) => {
          const active = s.sheetId === activeId;
          const isCached = cache.current.has(s.sheetId);
          return (
            <button
              key={s.sheetId}
              onClick={() => setActiveId(s.sheetId)}
              title={isCached ? "cached (instant)" : "loads on click"}
              style={{
                flex: "0 0 auto", padding: "5px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                border: `1px solid ${active ? "#101828" : "#e4e7ec"}`,
                background: active ? "#101828" : "#fff",
                color: active ? "#fff" : isCached ? "#101828" : "#98a2b3",
                fontWeight: active ? 600 : isCached ? 500 : 400,
              }}
            >
              {s.name}
              {isCached && !active ? " ✓" : ""}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {snap ? (
          <LevichSheet
            key={`${activeId!}:${fontsReady}`} // remount per sheet + once fonts load
            data={NO_DATA}
            columns={NO_COLUMNS}
            snapshot={snap}
            onReady={() => {
              const f = lastFetch.current;
              const renderMs = Math.round(performance.now() - renderT0.current);
              setNote(`${activeName}: ${f.cached ? "cached (0ms fetch)" : `fetched ${f.kb}KB in ${f.fetchMs}ms`} · rendered ${renderMs}ms`);
            }}
          />
        ) : (
          <div style={{ padding: 40, color: "#667085" }}>Loading {activeName || "sheet"}…</div>
        )}
      </div>
    </div>
  );
}

export default PocApp;
