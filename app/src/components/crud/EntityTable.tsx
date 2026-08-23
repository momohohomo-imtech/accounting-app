"use client";

import { useState } from "react";
import type { FieldConfig } from "./types";
import { EntityForm } from "./EntityForm";
import { Table, THead, Th, Tr, Td } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";

type Row = Record<string, unknown> & { id: string };

export function EntityTable({
  fields,
  rows,
  updateAction,
  deleteAction,
}: {
  fields: FieldConfig[];
  rows: Row[];
  updateAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">등록된 항목이 없습니다.</p>;
  }

  return (
    <Table className="min-w-[700px]">
      <THead>
        {fields.map((f) => (
          <Th key={f.name} className="pr-4">
            {f.label}
          </Th>
        ))}
        <Th className="text-right">관리</Th>
      </THead>
      <tbody>
        {rows.map((row) =>
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
              {fields.map((f) => {
                const raw = row[f.name];
                const display =
                  f.type === "select"
                    ? f.options?.find((o) => o.value === raw)?.label ?? String(raw ?? "-")
                    : f.type === "checkbox"
                    ? raw
                      ? "예"
                      : "아니오"
                    : raw === null || raw === undefined || raw === ""
                    ? "-"
                    : String(raw);
                return (
                  <Td key={f.name} className="max-w-[220px] truncate pr-4">
                    {display}
                  </Td>
                );
              })}
              <Td className="text-right">
                <div className="flex justify-end gap-2">
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
