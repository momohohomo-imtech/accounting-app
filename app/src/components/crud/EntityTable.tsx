"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { FieldConfig } from "./types";
import { EntityForm } from "./EntityForm";
import { Table, THead, Tr, Td } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";

type Row = Record<string, unknown> & { id: string };

function displayValue(row: Row, f: FieldConfig) {
  const raw = row[f.name];
  if (f.type === "select") return f.options?.find((o) => o.value === raw)?.label ?? String(raw ?? "-");
  if (f.type === "checkbox") return raw ? "예" : "아니오";
  return raw === null || raw === undefined || raw === "" ? "-" : String(raw);
}

export function EntityTable({
  fields,
  rows,
  updateAction,
  deleteAction,
  renderExtraActions,
}: {
  fields: FieldConfig[];
  rows: Row[];
  updateAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
  renderExtraActions?: (row: Row) => ReactNode;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

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

  return (
    <Table className="min-w-[700px]">
      <THead>
        {fields.map((f) => (
          <th key={f.name} className="whitespace-nowrap pb-2 pr-4 font-medium">
            <button
              type="button"
              onClick={() => handleSort(f.name)}
              className="inline-flex items-center gap-1 transition-colors hover:text-slate-800"
            >
              {f.label}
              {sortKey === f.name && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
            </button>
          </th>
        ))}
        <th className="pb-2 text-right font-medium">관리</th>
      </THead>
      <tbody>
        {sortedRows.map((row) =>
          editingId === row.id ? (
            <Tr key={row.id} className="bg-slate-50">
              <td colSpan={fields.length + 1} className="py-3 pr-4">
                <form
                  action={(fd) => {
                    updateAction(fd);
                    setEditingId(null);
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
              {fields.map((f) => (
                <Td key={f.name} className="max-w-[220px] truncate pr-4">
                  {displayValue(row, f)}
                </Td>
              ))}
              <Td className="text-right">
                <div className="flex justify-end gap-2">
                  {renderExtraActions?.(row)}
                  <Button variant="secondary" size="xs" onClick={() => setEditingId(row.id)}>
                    수정
                  </Button>
                  <form
                    action={deleteAction}
                    onSubmit={(e) => {
                      if (!confirm("삭제하시겠습니까?")) e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="id" value={row.id} />
                    <Button variant="danger" size="xs">
                      삭제
                    </Button>
                  </form>
                </div>
              </Td>
            </Tr>
          )
        )}
      </tbody>
    </Table>
  );
}
