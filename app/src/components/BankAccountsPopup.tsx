"use client";

import { useState } from "react";
import { CreatePanel } from "@/components/crud/CreatePanel";
import { EntityTable } from "@/components/crud/EntityTable";
import { ModalPortal } from "@/components/ModalPortal";
import { useEscapeKey } from "@/lib/useEscapeKey";
import type { FieldConfig } from "@/components/crud/types";

export function BankAccountsPopup({
  fields,
  accounts,
  createAction,
  updateAction,
  deleteAction,
}: {
  fields: FieldConfig[];
  accounts: (Record<string, unknown> & { id: string })[];
  createAction: (formData: FormData) => unknown;
  updateAction: (formData: FormData) => unknown;
  deleteAction: (formData: FormData) => unknown;
}) {
  const [open, setOpen] = useState(false);
  useEscapeKey(open, () => setOpen(false));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
      >
        계좌 목록
      </button>

      {open && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10"
            onClick={() => setOpen(false)}
          >
            <div className="w-full max-w-3xl space-y-4 rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900">계좌 목록</h2>
                <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500 hover:text-slate-800">
                  닫기
                </button>
              </div>

              <CreatePanel title="은행 계좌" fields={fields} createAction={createAction} />

              <EntityTable fields={fields} rows={accounts} updateAction={updateAction} deleteAction={deleteAction} />
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
