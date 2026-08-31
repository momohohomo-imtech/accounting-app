"use client";

import { useMemo, useState } from "react";
import { formatWon, formatDate } from "@/lib/format";
import { LinkButton, Button } from "@/components/ui/Button";
import { PayrollForm, type EmployeeOption, type PayrollInitial } from "@/components/PayrollForm";

type PayrollRow = PayrollInitial & { id: string; employees?: { name: string } | null };
type SortKey = "employee" | "pay_month" | "total" | "deduction" | "net";

function derive(p: PayrollRow) {
  const total = p.amount + p.bonus;
  const deductionTotal =
    p.national_pension +
    p.health_insurance +
    p.long_term_care_insurance +
    p.employment_insurance +
    p.income_tax +
    p.local_income_tax +
    p.rural_tax -
    p.employment_insurance_refund;
  const net = total - deductionTotal + p.non_taxable_unreported;
  return { total, deductionTotal, net };
}

export function PayrollTable({
  payroll,
  employees,
  year,
  updateAction,
  deleteAction,
}: {
  payroll: PayrollRow[];
  employees: EmployeeOption[];
  year: number;
  updateAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function headerButton(key: SortKey, label: string) {
    return (
      <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 hover:text-slate-800">
        {label}
        {sortKey === key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  }

  const sortedPayroll = useMemo(() => {
    if (!sortKey) return payroll;
    const copy = [...payroll];
    copy.sort((a, b) => {
      let cmp: number;
      if (sortKey === "employee") {
        cmp = (a.employees?.name ?? "").localeCompare(b.employees?.name ?? "");
      } else if (sortKey === "pay_month") {
        cmp = a.pay_month.localeCompare(b.pay_month);
      } else {
        cmp = derive(a)[sortKey === "total" ? "total" : sortKey === "deduction" ? "deductionTotal" : "net"] -
          derive(b)[sortKey === "total" ? "total" : sortKey === "deduction" ? "deductionTotal" : "net"];
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [payroll, sortKey, sortDir]);

  return (
    <table className="w-full min-w-[700px] text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-slate-500">
          <th className="pb-2 pr-4">{headerButton("employee", "직원")}</th>
          <th className="pb-2 pr-4">{headerButton("pay_month", "지급월")}</th>
          <th className="pb-2 pr-4 text-right">{headerButton("total", "지급합계")}</th>
          <th className="pb-2 pr-4 text-right">{headerButton("deduction", "공제합계")}</th>
          <th className="pb-2 pr-4 text-right">{headerButton("net", "차인지급액")}</th>
          <th className="pb-2 text-right">관리</th>
        </tr>
      </thead>
      <tbody>
        {sortedPayroll.map((p) => {
          if (editingId === p.id) {
            return (
              <tr key={p.id} className="border-b border-slate-100 bg-slate-50 last:border-0">
                <td colSpan={6} className="py-3 pr-4">
                  <PayrollForm
                    employees={employees}
                    action={async (fd) => {
                      await updateAction(fd);
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

          const { total, deductionTotal, net } = derive(p);

          return (
            <tr key={p.id} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-4 text-slate-700">{p.employees?.name}</td>
              <td className="py-2 pr-4 text-slate-700">{formatDate(p.pay_month).slice(0, 7)}</td>
              <td className="py-2 pr-4 text-right text-slate-700">{formatWon(total)}</td>
              <td className="py-2 pr-4 text-right text-slate-500">{formatWon(deductionTotal)}</td>
              <td className="py-2 pr-4 text-right font-medium text-slate-900">{formatWon(net)}</td>
              <td className="py-2 text-right">
                <div className="flex justify-end gap-2">
                  <LinkButton href={`/employees?year=${year}&payslip=${p.id}`} variant="secondary" size="xs">
                    명세서
                  </LinkButton>
                  <Button variant="secondary" size="xs" onClick={() => setEditingId(p.id)}>
                    수정
                  </Button>
                  {confirmDeleteId === p.id ? (
                    <form action={deleteAction} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={p.id} />
                      <span className="text-xs font-medium text-red-600">정말 삭제?</span>
                      <Button variant="danger" size="xs" type="submit">
                        확인
                      </Button>
                      <Button variant="secondary" size="xs" type="button" onClick={() => setConfirmDeleteId(null)}>
                        취소
                      </Button>
                    </form>
                  ) : (
                    <Button variant="danger" size="xs" type="button" onClick={() => setConfirmDeleteId(p.id)}>
                      삭제
                    </Button>
                  )}
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
