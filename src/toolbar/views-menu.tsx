/**
 * ViewsMenu — the unified Google-Sheets "views" dropdown (rendered inside the
 * toolbar's Filter-views Dropdown portal). Mirrors Google's menu:
 *
 *   + Create group by view  ▸   (flyout: one row per column)
 *   + Create filter view
 *   ▣ View options          ▸   (flyout: Save view / Refresh view)
 *   ───────────────
 *   [saved views: filter + group, ✓ active, rename / delete]
 *   ───────────────
 *   ✕ Exit view                 (only when a view is active)
 *
 * Pure presentation — all behaviour is passed in via props. Flyouts open to the
 * LEFT because the menu sits near the right edge of the toolbar.
 */
import { useState, type CSSProperties, type ReactNode } from "react";
import { Edit01, Trash01 } from "@untitledui/icons";
import type { FilterView } from "../features/filter-views";
import type { GroupColumn, GroupView } from "../features/group-by-view";

const INK = "#101828";
const TXT = "#344054";
const HOVER = "#f9fafb";

const itemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "8px 10px",
  borderRadius: 6,
  border: "none",
  background: "transparent",
  color: TXT,
  fontSize: 13,
  textAlign: "left",
  cursor: "pointer",
  fontFamily: "inherit",
  whiteSpace: "nowrap",
};

const sep: CSSProperties = { height: 1, background: "#eaecf0", margin: "6px 4px" };

function ChevR() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" style={{ marginLeft: "auto" }}>
      <path d="M9 6l6 6-6 6" fill="none" stroke="#98a2b3" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Row({ children, onClick, onMouseEnter, title }: { children: ReactNode; onClick?: () => void; onMouseEnter?: () => void; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = HOVER;
        onMouseEnter?.();
      }}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      style={itemStyle}
    >
      {children}
    </button>
  );
}

/** A left-opening flyout anchored to a parent row. */
function Flyout({ top, children }: { top: number; children: ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        right: "calc(100% + 4px)",
        top,
        minWidth: 170,
        maxHeight: 320,
        overflowY: "auto",
        background: "#fff",
        border: "1px solid #eaecf0",
        borderRadius: 10,
        boxShadow: "0 8px 24px rgba(16,24,40,0.14)",
        padding: 6,
        zIndex: 1,
      }}
    >
      {children}
    </div>
  );
}

export interface ViewsMenuProps {
  columns: GroupColumn[];
  filterViews: FilterView[];
  groupViews: GroupView[];
  activeViewId: string | null;
  editingViewId: string | null;
  onCreateFilterView: () => void;
  onCreateGroupBy: (colIndex: number, label: string) => void;
  onApplyFilterView: (v: FilterView) => void;
  onApplyGroupView: (v: GroupView) => void;
  onSaveView: () => void;
  onRefreshView: () => void;
  onExitView: () => void;
  onStartRename: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  close: () => void;
}

export function ViewsMenu(props: ViewsMenuProps) {
  const { columns, filterViews, groupViews, activeViewId, editingViewId } = props;
  const [sub, setSub] = useState<"group" | "options" | null>(null);
  const hasViews = filterViews.length > 0 || groupViews.length > 0;

  const PlusIcon = <span style={{ fontSize: 17, lineHeight: 0, width: 16, textAlign: "center", color: INK }}>+</span>;

  return (
    <div onMouseLeave={() => setSub(null)}>
      {/* Create group by view ▸ */}
      <div style={{ position: "relative" }} onMouseEnter={() => setSub("group")}>
        <Row>
          {PlusIcon} Create group by view <ChevR />
        </Row>
        {sub === "group" && (
          <Flyout top={0}>
            {columns.map((c) => (
              <Row key={c.index} onClick={() => { props.onCreateGroupBy(c.index, c.label); props.close(); }}>
                {c.label}
              </Row>
            ))}
          </Flyout>
        )}
      </div>

      {/* Create filter view */}
      <Row onMouseEnter={() => setSub(null)} onClick={() => { props.onCreateFilterView(); props.close(); }}>
        {PlusIcon} Create filter view
      </Row>

      {/* View options ▸ */}
      <div style={{ position: "relative" }} onMouseEnter={() => setSub("options")}>
        <Row>
          <GridGlyph /> View options <ChevR />
        </Row>
        {sub === "options" && (
          <Flyout top={0}>
            <Row onClick={() => { props.onSaveView(); props.close(); }} title={activeViewId ? "Update this view with the current filters/sort" : "Apply & save a view first"}>
              <SaveGlyph /> Save view
            </Row>
            <Row onClick={() => { props.onRefreshView(); props.close(); }} title="Re-apply the active view">
              <RefreshGlyph /> Refresh view
            </Row>
          </Flyout>
        )}
      </div>

      {hasViews && <div style={sep} />}

      {/* Saved filter views */}
      {filterViews.map((v) => (
        <ViewRow
          key={v.id}
          name={v.name}
          active={activeViewId === v.id}
          editing={editingViewId === v.id}
          onApply={() => { props.onApplyFilterView(v); props.close(); }}
          onStartRename={() => props.onStartRename(v.id)}
          onRename={(name) => props.onRename(v.id, name)}
          onDelete={() => props.onDelete(v.id)}
        />
      ))}
      {/* Saved group views */}
      {groupViews.map((v) => (
        <ViewRow
          key={v.id}
          name={v.name}
          active={activeViewId === v.id}
          editing={editingViewId === v.id}
          onApply={() => { props.onApplyGroupView(v); props.close(); }}
          onStartRename={() => props.onStartRename(v.id)}
          onRename={(name) => props.onRename(v.id, name)}
          onDelete={() => props.onDelete(v.id)}
        />
      ))}

      {activeViewId && (
        <>
          <div style={sep} />
          <Row onMouseEnter={() => setSub(null)} onClick={() => { props.onExitView(); props.close(); }}>
            <span style={{ width: 16, textAlign: "center", color: "#475467" }}>✕</span> Exit view
          </Row>
        </>
      )}
    </div>
  );
}

/** One saved-view row: apply (click) · rename · delete. */
function ViewRow({
  name,
  active,
  editing,
  onApply,
  onStartRename,
  onRename,
  onDelete,
}: {
  name: string;
  active: boolean;
  editing: boolean;
  onApply: () => void;
  onStartRename: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 2, borderRadius: 6 }}
      onMouseEnter={(e) => (e.currentTarget.style.background = HOVER)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {editing ? (
        <input
          autoFocus
          defaultValue={name}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter") onRename((e.target as HTMLInputElement).value);
            else if (e.key === "Escape") onRename(name);
          }}
          onBlur={(e) => onRename(e.target.value)}
          style={{ flex: 1, margin: "2px 0 2px 10px", padding: "5px 8px", border: `1px solid ${INK}`, borderRadius: 6, fontSize: 13, fontFamily: "inherit", outline: "none" }}
        />
      ) : (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onApply}
          onDoubleClick={onStartRename}
          title="Click to apply · double-click to rename"
          style={{ ...itemStyle, flex: 1, color: active ? INK : TXT, fontWeight: active ? 600 : 400 }}
        >
          <span style={{ width: 16, color: INK }}>{active ? "✓" : ""}</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
        </button>
      )}
      {!editing && (
        <>
          <IconBtn label="Rename" onClick={onStartRename} hover="#475467">
            <Edit01 size={15} />
          </IconBtn>
          <IconBtn label="Delete" onClick={onDelete} hover="#d92d20">
            <Trash01 size={15} />
          </IconBtn>
        </>
      )}
    </div>
  );
}

function IconBtn({ label, onClick, hover, children }: { label: string; onClick: () => void; hover: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={{ border: "none", background: "transparent", color: "#98a2b3", cursor: "pointer", padding: "6px 6px", borderRadius: 6, display: "inline-flex" }}
      onMouseEnter={(e) => (e.currentTarget.style.color = hover)}
      onMouseLeave={(e) => (e.currentTarget.style.color = "#98a2b3")}
    >
      {children}
    </button>
  );
}

/* ---- small glyphs --------------------------------------------------------- */
function GridGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="#475467" strokeWidth="1.7" />
      <path d="M3 9h18M9 9v12" stroke="#475467" strokeWidth="1.7" />
    </svg>
  );
}
function SaveGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path d="M5 3h11l3 3v15H5z" fill="none" stroke="#475467" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 3v5h7V3M8 21v-7h8v7" fill="none" stroke="#475467" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}
function RefreshGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path d="M20 11a8 8 0 1 0-1.5 5" fill="none" stroke="#475467" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M20 4v5h-5" fill="none" stroke="#475467" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
