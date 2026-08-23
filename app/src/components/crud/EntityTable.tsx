"use client";

import { useState } from "react";
import type { FieldConfig } from "./types";
import { EntityForm } from "./EntityForm";

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
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            {fields.map((f) => (
              <th key={f.name} className="whitespace-nowrap pb-2 pr-4">
                {f.label}
              </th>
            ))}
            <th className="pb-2 text-right">관리</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) =>
            editingId === row.id ? (
              <tr key={row.id} className="border-b border-slate-100 bg-slate-50">
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
                      <button
                        type="submit"
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                      >
                        저장
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
                      >
                        취소
                      </button>
                    </div>
                  </form>
                </td>
              </tr>
            ) : (
              <tr key={row.id} className="border-b border-slate-100 last:border-0">
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
                    <td key={f.name} className="max-w-[220px] truncate py-2 pr-4 text-slate-700">
                      {display}
                    </td>
                  );
                })}
                <td className="py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingId(row.id)}
                      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
                    >
                      수정
                    </button>
                    <form
                      action={deleteAction}
                      onSubmit={(e) => {
                        if (!confirm("삭제하시겠습니까?")) e.preventDefault();
                      }}
                    >
                      <input type="hidden" name="id" value={row.id} />
                      <button className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50">
                        삭제
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
