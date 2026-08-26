"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { FieldConfig } from "./types";
import { EntityForm } from "./EntityForm";
import { Table, THead, Tr, Td } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { formatNumber } from "@/lib/format";

type Row = Record<string, unknown> & { id: string };

function displayValue(row: Row, f: FieldConfig) {
  const raw = row[f.name];
  if (f.type === "select") return f.options?.find((o) => o.value === raw)?.label ?? String(raw ?? "-");
  if (f.type === "project-search") {
    if (!raw) return "-";
    return f.projectSearchOptions?.find((o) => o.value === raw)?.label ?? String(raw);
  }
  if (f.type === "checkbox") return raw ? "O" : "";
  if (raw === null || raw === undefined || raw === "") return "-";
  if (f.format === "currency") return formatNumber(raw as number | string);
  return String(raw);
}

function cellColorClass(row: Row, f: FieldConfig): string | undefined {
  if (f.colorField) return row[f.colorField] ? "text-red-600" : undefined;
  if (f.redValue !== undefined) return row[f.name] === f.redValue ? "text-red-600" : undefined;
  if (f.type === "select") {
    const color = f.options?.find((o) => o.value === row[f.name])?.color;
    if (color === "red") return "text-red-600";
    if (color === "blue") return "text-blue-600";
  }
  return undefined;
}

function ProgressCell({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full shrink-0 overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : "bg-blue-500"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function EntityTable({
  fields,
  rows,
  updateAction,
  deleteAction,
  extraActions,
  editPopup,
}: {
  fields: FieldConfig[];
  rows: Row[];
  updateAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
  extraActions?: Record<string, ReactNode>;
  /** Show the edit form in a modal instead of expanding the row inline. */
  editPopup?: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const visibleFields = useMemo(() => fields.filter((f) => !f.hideInTable), [fields]);
  const hasWidths = visibleFields.some((f) => f.width);
  const sortField = fields.find((f) => f.name === sortKey);

  function handleSort(name: string) {
    if (name === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(name);
      setSortDir("asc");
    }
  }

  const sortedRows = useMemo(() => {
    if (!sortField) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = displayValue(a, sortField);
      const vb = displayValue(b, sortField);
      const na = Number(a[sortField.name]);
      const nb = Number(b[sortField.name]);
      const cmp =
        !Number.isNaN(na) && !Number.isNaN(nb) && a[sortField.name] !== null && b[sortField.name] !== null
          ? na - nb
          : va.localeCompare(vb);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortField, sortDir]);

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">등록된 항목이 없습니다.</p>;
  }

  const editingRow = editPopup ? sortedRows.find((r) => r.id === editingId) : undefined;

  return (
    <>
    <Table className={hasWidths ? "min-w-[700px] table-fixed" : "min-w-[700px]"}>
      <THead>
        {visibleFields.map((f) => (
          <th
            key={f.name}
            style={f.width ? { width: f.width } : undefined}
            className="whitespace-nowrap pb-2 pr-4 font-medium"
          >
            <button
              type="button"
              onClick={() => handleSort(f.name)}
              className="inline-flex items-center gap-1 transition-colors hover:text-slate-800"
            >
              {f.tableLabel ?? f.label}
              {sortKey === f.name && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
            </button>
          </th>
        ))}
        <th className="pb-2 text-right font-medium print:hidden" style={hasWidths ? { width: "8%" } : undefined}>
          관리
        </th>
      </THead>
      <tbody>
        {sortedRows.map((row) =>
          editingId === row.id && !editPopup ? (
            <Tr key={row.id} className="bg-slate-50">
              <td colSpan={visibleFields.length + 1} className="py-3 pr-4">
                <form
                  action={(fd) => {
                    updateAction(fd);
                    setEditingId(null);
                  }}
                  onSubmit={(e) => {
                    if (!confirm("수정 내용을 저장하시겠습니까?")) e.preventDefault();
                  }}
                  className="space-y-3"
                >
                  <input type="hidden" name="id" value={row.id} />
                  <EntityForm fields={fields} defaultValues={row} />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm">
                      저장
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setEditingId(null)}>
                      취소
                    </Button>
                  </div>
                </form>
              </td>
            </Tr>
          ) : (
            <Tr key={row.id}>
              {visibleFields.map((f) => (
                <Td
                  key={f.name}
                  style={f.width ? { width: f.width } : undefined}
                  title={f.display === "progress" ? undefined : displayValue(row, f)}
                  className="max-w-[220px] truncate pr-4 print:whitespace-normal print:overflow-visible"
                >
                  {f.display === "progress" ? (
                    <ProgressCell value={Number(row[f.name]) || 0} />
                  ) : cellColorClass(row, f) ? (
                    <span className={cellColorClass(row, f)}>{displayValue(row, f)}</span>
                  ) : (
                    displayValue(row, f)
                  )}
                </Td>
              ))}
              <Td className="text-right print:hidden">
                <div className="flex justify-end gap-2">
                  {extraActions?.[row.id]}
                  <Button variant="secondary" size="xs" onClick={() => setEditingId(row.id)}>
                    수정
                  </Button>
                  {confirmDeleteId === row.id ? (
                    <form action={deleteAction} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={row.id} />
                      <span className="text-xs font-medium text-red-600">정말 삭제?</span>
                      <Button variant="danger" size="xs" type="submit">
                        확인
                      </Button>
                      <Button variant="secondary" size="xs" type="button" onClick={() => setConfirmDeleteId(null)}>
                        취소
                      </Button>
                    </form>
                  ) : (
                    <Button variant="danger" size="xs" type="button" onClick={() => setConfirmDeleteId(row.id)}>
                      삭제
                    </Button>
                  )}
                </div>
              </Td>
            </Tr>
          )
        )}
      </tbody>
    </Table>

    {editingRow && (
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10 print:hidden">
        <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">수정</h2>
          <form
            action={(fd) => {
              updateAction(fd);
              setEditingId(null);
            }}
            onSubmit={(e) => {
              if (!confirm("수정 내용을 저장하시겠습니까?")) e.preventDefault();
            }}
            className="space-y-3"
          >
            <input type="hidden" name="id" value={editingRow.id} />
            <EntityForm fields={fields} defaultValues={editingRow} />
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                저장
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditingId(null)}>
                취소
              </Button>
            </div>
          </form>
        </div>
      </div>
    )}
    </>
  );
}
