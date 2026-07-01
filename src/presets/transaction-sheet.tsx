/**
 * TransactionSheet — a ready-made, branded account-transaction view built on
 * <LevichSheet> (one preset configuration, not the baseline). Mirrors the
 * flux-poc reference: frozen header, locked ledger (GL) columns, an editable
 * Comment column, currency formatting, and a live TOTAL row over Amount.
 *
 * Comments + column widths persist to localStorage, bucketed by
 * (subsidiaryId, accountId). Consumers may override via props.
 */
import { useCallback, useMemo, useState } from "react";
import { LevichSheet } from "../LevichSheet";
import type { ColumnDef, FooterConfig, FreezeConfig, SheetData, TransactionRow, TransactionSheetProps } from "../core/types";

const COLUMNS: ColumnDef[] = [
  { key: "date", header: "Date", format: "date", locked: true, width: 110 },
  { key: "tranId", header: "Tran #", locked: true, width: 120 },
  { key: "type", header: "Type", locked: true, width: 120 },
  { key: "entity", header: "Entity", locked: true, width: 150 },
  { key: "debit", header: "Debit", format: "currency", locked: true, width: 120 },
  { key: "credit", header: "Credit", format: "currency", locked: true, width: 120 },
  { key: "amount", header: "Amount", format: "currency", locked: true, width: 130 },
  { key: "memo", header: "Memo", locked: true, width: 280 },
  { key: "comment", header: "Comment", editable: true, width: 280 },
];

const FREEZE: FreezeConfig = { rows: 1 };
const FOOTER: FooterConfig = { label: "TOTAL", sumColumnKey: "amount", labelColumnKey: "memo" };

function rowKeyOf(r: TransactionRow): string {
  return `${r.transactionId}:${r.lineId}`;
}

function storageKey(kind: "comments" | "widths", sub?: string, acc?: string): string {
  return `levich:${kind}:${sub ?? "_"}:${acc ?? "_"}`;
}

function loadJSON<T>(key: string): T | undefined {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function saveJSON(key: string, value: unknown): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — ignore */
  }
}

export function TransactionSheet({
  rows,
  currencySymbol = "$",
  subsidiaryId,
  accountId,
  comments,
  columnWidths,
  className,
}: TransactionSheetProps) {
  const commentsKey = storageKey("comments", subsidiaryId, accountId);
  const widthsKey = storageKey("widths", subsidiaryId, accountId);

  const seededComments = useMemo<Record<string, string>>(
    () => comments ?? loadJSON<Record<string, string>>(commentsKey) ?? {},
    [comments, commentsKey],
  );
  const seededWidths = useMemo<Record<number, number>>(
    () => columnWidths ?? loadJSON<Record<number, number>>(widthsKey) ?? {},
    [columnWidths, widthsKey],
  );

  // Mutable accumulator so each comment save persists the full set.
  const [commentStore] = useState<Record<string, string>>(() => ({ ...seededComments }));

  const data = useMemo<SheetData>(
    () =>
      rows.map((r) => ({
        date: r.date,
        tranId: r.tranId,
        type: r.type,
        entity: r.entity,
        debit: r.debit,
        credit: r.credit,
        amount: r.amount,
        memo: r.memo,
        comment: r.comment ?? "",
      })),
    [rows],
  );

  const getRowKey = useCallback((_record: Record<string, unknown>, index: number) => rowKeyOf(rows[index]), [rows]);

  const onCellEdit = useCallback(
    (e: { rowKey: string; value: string }) => {
      commentStore[e.rowKey] = e.value;
      saveJSON(commentsKey, commentStore);
    },
    [commentStore, commentsKey],
  );

  const onColumnWidthsChange = useCallback((w: Record<number, number>) => saveJSON(widthsKey, w), [widthsKey]);

  return (
    <LevichSheet
      className={className}
      data={data}
      columns={COLUMNS}
      currencySymbol={currencySymbol}
      freeze={FREEZE}
      footer={FOOTER}
      comments={seededComments}
      columnWidths={seededWidths}
      getRowKey={getRowKey}
      onCellEdit={onCellEdit}
      onColumnWidthsChange={onColumnWidthsChange}
    />
  );
}

export default TransactionSheet;
