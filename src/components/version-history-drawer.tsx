/**
 * <VersionHistoryDrawer> — a Google-Sheets-style right-side version drawer (VH-1).
 *
 * Fully controlled: it owns no version state, only its own ⋮ menu UI. The host
 * (product-app) passes the version list + the current/previewing ids and handles
 * every action (preview / restore / name / make-a-copy / view-original).
 *
 * Look matches <SheetTabBar> and the modal primitives: Work Sans, Untitled UI
 * icons, soft borders, the same popover panel styling. Constitution II/IX-safe —
 * no engine internals, no paid plugins, browser-only.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, DotsVertical, Edit01, Copy01 } from "@untitledui/icons";
import type { Version } from "../features/version-store";

export interface VersionHistoryDrawerProps {
  open: boolean;
  versions: Version[];
  /** The current (head) version id — gets the "Current version" badge. */
  currentVersionId: string | null;
  /** The version currently being previewed in the grid (highlighted). */
  previewingId?: string | null;
  onClose: () => void;
  onPreview: (version: Version) => void;
  onRestore: (version: Version) => void;
  onName: (version: Version) => void;
  onMakeCopy: (version: Version) => void;
  onViewOriginal: () => void;
  /** "Highlight changes" toggle (VH-2 diff). Shown while previewing a version. */
  highlightChanges?: boolean;
  /** "Show unmodified rows" toggle (VH-2 diff). Shown while previewing a version. */
  showUnmodifiedRows?: boolean;
  onToggleHighlight?: (on: boolean) => void;
  onToggleUnmodified?: (on: boolean) => void;
}

const WIDTH = 320;
const FONT = "'Work Sans', ui-sans-serif, system-ui, sans-serif";

// A stable-ish colour for the author dot (single-user demo → one colour).
const AUTHOR_COLORS = ["#7f56d9", "#12b76a", "#f79009", "#2e90fa", "#ee46bc"];
function authorColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AUTHOR_COLORS[h % AUTHOR_COLORS.length];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

/** "4 Jul, 18:19" */
function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Day bucket label: "Today" / "Yesterday" / "4 July 2026". */
function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const KIND_LABEL: Partial<Record<Version["kind"], string>> = {
  import: "Imported .xlsx file",
  blank: "Blank spreadsheet",
  restore: "Restored version",
};

const menuPanel: CSSProperties = {
  position: "fixed", minWidth: 180, background: "#fff", border: "1px solid #eaecf0", borderRadius: 10,
  boxShadow: "0 12px 32px rgba(16,24,40,0.16)", padding: 6, zIndex: 4600, fontFamily: FONT,
};
const menuItem: CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 12px", borderRadius: 6,
  border: "none", background: "transparent", color: "#344054", fontSize: 13, textAlign: "left", cursor: "pointer", whiteSpace: "nowrap",
};

export function VersionHistoryDrawer(props: VersionHistoryDrawerProps) {
  const { open, versions, currentVersionId, previewingId, onClose, onPreview, onRestore, onName, onMakeCopy, onViewOriginal,
    highlightChanges, showUnmodifiedRows, onToggleHighlight, onToggleUnmodified } = props;
  const [menuFor, setMenuFor] = useState<{ id: string; x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the ⋮ menu on outside click / Esc.
  useEffect(() => {
    if (!menuFor) return;
    const onDown = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuFor(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuFor(null); };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown, true); document.removeEventListener("keydown", onKey); };
  }, [menuFor]);

  if (!open) return null;

  // Newest first, grouped by day (preserving newest-first order within a group).
  const ordered = [...versions].sort((a, b) => b.seq - a.seq);
  const groups: Array<{ label: string; items: Version[] }> = [];
  for (const v of ordered) {
    const label = dayLabel(v.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(v);
    else groups.push({ label, items: [v] });
  }

  const menuVersion = menuFor ? versions.find((v) => v.id === menuFor.id) ?? null : null;

  return (
    <aside
      style={{
        width: WIDTH, flex: `0 0 ${WIDTH}px`, height: "100%", background: "#fff",
        borderLeft: "1px solid #e4e7ec", display: "flex", flexDirection: "column", fontFamily: FONT,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 12px 12px 8px", borderBottom: "1px solid #eef0f3" }}>
        <button
          type="button" aria-label="Close version history" title="Close" onClick={onClose}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", color: "#475467", cursor: "pointer" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#f2f4f7")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <ChevronLeft size={20} />
        </button>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#101828" }}>Version history</span>
      </div>

      {/* Version list */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 0 12px" }}>
        {groups.length === 0 && (
          <div style={{ padding: "16px 16px", color: "#98a2b3", fontSize: 13 }}>No versions yet</div>
        )}
        {groups.map((g) => (
          <div key={g.label}>
            <div style={{ padding: "12px 16px 6px", fontSize: 12, fontWeight: 700, color: "#667085", textTransform: "none" }}>{g.label}</div>
            {g.items.map((v) => {
              const isCurrent = v.id === currentVersionId;
              const isSelected = v.id === previewingId;
              const isOriginal = v.seq === 0 || v.kind === "import" || v.kind === "blank";
              return (
                <div
                  key={v.id}
                  onClick={() => onPreview(v)}
                  style={{
                    position: "relative", cursor: "pointer", padding: "10px 12px 10px 16px", margin: "0 8px", borderRadius: 8,
                    background: isSelected ? "#eff4ff" : "transparent",
                    boxShadow: isSelected ? "inset 0 0 0 1px #b2ccff" : "none",
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "#f9fafb"; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#101828" }}>
                      {v.label ?? formatTime(v.createdAt)}
                    </span>
                    {/* ⋮ menu */}
                    <button
                      type="button" aria-label="Version options" title="More"
                      onClick={(e) => {
                        e.stopPropagation();
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setMenuFor((cur) => (cur?.id === v.id ? null : { id: v.id, x: r.right, y: r.bottom }));
                      }}
                      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 6, border: "none", background: "transparent", color: "#98a2b3", cursor: "pointer", flexShrink: 0 }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#eceef1")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <DotsVertical size={16} />
                    </button>
                  </div>

                  {/* Author + Current badge */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: authorColor(v.author), display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "#667085" }}>{v.author}</span>
                    {isCurrent && (
                      <span style={{ marginLeft: 4, fontSize: 11, fontWeight: 600, color: "#027a48", background: "#ecfdf3", border: "1px solid #abefc6", borderRadius: 999, padding: "1px 8px" }}>Current version</span>
                    )}
                  </div>

                  {/* Original label + View original link */}
                  {isOriginal && KIND_LABEL[v.kind] && (
                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: "#98a2b3" }}>{KIND_LABEL[v.kind]}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onViewOriginal(); }}
                        style={{ border: "none", background: "transparent", color: "#2e90fa", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0 }}
                      >
                        View original
                      </button>
                    </div>
                  )}

                  {/* Restore affordance on the selected (non-current) version */}
                  {isSelected && !isCurrent && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onRestore(v); }}
                      style={{ marginTop: 10, width: "100%", padding: "8px 12px", borderRadius: 8, border: "none", background: "#101828", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                    >
                      Restore this version
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Diff toggles (Google-Sheets style) — shown while previewing a version */}
      {previewingId && (onToggleHighlight || onToggleUnmodified) && (
        <div style={{ borderTop: "1px solid #eef0f3", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#344054", cursor: "pointer" }}>
            <input type="checkbox" checked={!!highlightChanges} onChange={(e) => onToggleHighlight?.(e.target.checked)} style={{ width: 16, height: 16, accentColor: "#101828", cursor: "pointer" }} />
            Highlight changes
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#344054", cursor: "pointer" }}>
            <input type="checkbox" checked={!!showUnmodifiedRows} onChange={(e) => onToggleUnmodified?.(e.target.checked)} style={{ width: 16, height: 16, accentColor: "#101828", cursor: "pointer" }} />
            Show unmodified rows
          </label>
        </div>
      )}

      {/* ⋮ dropdown */}
      {menuFor && menuVersion && (
        <div ref={menuRef} style={{ ...menuPanel, left: Math.min(menuFor.x, window.innerWidth - 190), top: menuFor.y + 4 }}>
          <button
            type="button" style={menuItem}
            onClick={() => { const v = menuVersion; setMenuFor(null); onName(v); }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <Edit01 size={16} color="#667085" /> Name this version
          </button>
          <button
            type="button" style={menuItem}
            onClick={() => { const v = menuVersion; setMenuFor(null); onMakeCopy(v); }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <Copy01 size={16} color="#667085" /> Make a copy
          </button>
        </div>
      )}
    </aside>
  );
}

export default VersionHistoryDrawer;
