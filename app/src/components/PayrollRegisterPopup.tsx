"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ModalPortal } from "@/components/ModalPortal";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { PayrollForm, type EmployeeOption } from "@/components/PayrollForm";

export function PayrollRegisterPopup({
  employees,
  action,
}: {
  employees: EmployeeOption[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  useEscapeKey(open, () => setOpen(false));

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ 급여 지급 등록</Button>
      {open && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10">
            <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">급여 지급 등록</h2>
                <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500 hover:text-slate-800">
                  닫기
                </button>
              </div>
              <PayrollForm
                employees={employees}
                action={async (fd) => {
                  await action(fd);
                  setOpen(false);
                }}
                onCancel={() => setOpen(false)}
              />
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
