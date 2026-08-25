"use client";

import { useState } from "react";
import { formatWon, formatDate } from "@/lib/format";
import { LinkButton, Button } from "@/components/ui/Button";
import { PayrollForm, type EmployeeOption, type PayrollInitial } from "@/components/PayrollForm";

type PayrollRow = PayrollInitial & { id: string; employees?: { name: string } | null };

export function PayrollTable({
  payroll,
  employees,
  updateAction,
  deleteAction,
}: {
  payroll: PayrollRow[];
  employees: EmployeeOption[];
  updateAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <table className="w-full min-w-[700px] text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-slate-500">
          <th className="pb-2 pr-4">직원</th>
          <th className="pb-2 pr-4">지급월</th>
          <th className="pb-2 pr-4 text-right">지급합계</th>
          <th className="pb-2 pr-4 text-right">공제합계</th>
          <th className="pb-2 pr-4 text-right">차인지급액</th>
          <th className="pb-2 text-right">관리</th>
        </tr>
      </thead>
      <tbody>
        {payroll.map((p) => {
          if (editingId === p.id) {
            return (
              <tr key={p.id} className="border-b border-slate-100 bg-slate-50 last:border-0">
                <td colSpan={6} className="py-3 pr-4">
                  <PayrollForm
                    employees={employees}
                    action={(fd) => {
                      updateAction(fd);
                      setEditingId(null);
                    }}
                    initial={p}
                    submitLabel="수정 저장"
                    onCancel={() => setEditingId(null)}
                  />
                </td>
              </tr>
            );
          }

          const total = p.amount + p.bonus;
          const deductionTotal =
            p.national_pension +
            p.health_insurance +
            p.long_term_care_insurance +
            p.employment_insurance +
            p.income_tax +
            p.local_income_tax +
            p.rural_tax;
          const net = total - deductionTotal + p.non_taxable_unreported;

          return (
            <tr key={p.id} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-4 text-slate-700">{p.employees?.name}</td>
              <td className="py-2 pr-4 text-slate-700">{formatDate(p.pay_month).slice(0, 7)}</td>
              <td className="py-2 pr-4 text-right text-slate-700">{formatWon(total)}</td>
              <td className="py-2 pr-4 text-right text-slate-500">{formatWon(deductionTotal)}</td>
              <td className="py-2 pr-4 text-right font-medium text-slate-900">{formatWon(net)}</td>
              <td className="py-2 text-right">
                <div className="flex justify-end gap-2">
                  <LinkButton href={`/employees?payslip=${p.id}`} variant="secondary" size="xs">
                    명세서
                  </LinkButton>
                  <Button variant="secondary" size="xs" onClick={() => setEditingId(p.id)}>
                    수정
                  </Button>
                  <form
                    action={deleteAction}
                    onSubmit={(e) => {
                      if (!confirm("삭제하시겠습니까?")) e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="id" value={p.id} />
                    <Button variant="danger" size="xs">
                      삭제
                    </Button>
                  </form>
                </div>
              </td>
            </tr>
          );
        })}
        {payroll.length === 0 && (
          <tr>
            <td colSpan={6} className="py-6 text-center text-slate-400">
              급여 지급 기록이 없습니다.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
