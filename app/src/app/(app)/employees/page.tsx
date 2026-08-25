import { createClient } from "@/lib/supabase/server";
import { CreatePanel } from "@/components/crud/CreatePanel";
import { EntityTable } from "@/components/crud/EntityTable";
import {
  createEmployeeRecord,
  updateEmployeeRecord,
  deleteEmployeeRecord,
  createPayrollRecord,
  deletePayrollRecord,
} from "@/lib/actions/employees";
import type { FieldConfig } from "@/components/crud/types";
import { formatWon, formatDate } from "@/lib/format";
import { PayrollForm } from "@/components/PayrollForm";
import { PayslipView } from "@/components/PayslipView";
import { LinkButton } from "@/components/ui/Button";

const employeeFields: FieldConfig[] = [
  { name: "employee_no", label: "사원번호" },
  { name: "name", label: "이름", required: true },
  { name: "role", label: "직위" },
  { name: "department", label: "부서" },
  { name: "employment_type", label: "고용형태" },
  { name: "hired_date", label: "입사일", type: "date" },
  { name: "resigned_date", label: "퇴사일", type: "date", hideInTable: true },
  { name: "phone", label: "휴대폰번호", type: "tel" },
  { name: "home_phone", label: "집 전화번호", type: "tel", hideInTable: true },
  { name: "address", label: "주소", hideInTable: true },
  { name: "emergency1_relation", label: "비상연락처1 관계", hideInTable: true },
  { name: "emergency1_phone", label: "비상연락처1 전화번호", type: "tel", hideInTable: true },
  { name: "emergency2_relation", label: "비상연락처2 관계", hideInTable: true },
  { name: "emergency2_phone", label: "비상연락처2 전화번호", type: "tel", hideInTable: true },
  { name: "monthly_salary", label: "월급", type: "number", format: "currency" },
  { name: "national_pension", label: "국민연금(월 차감액)", type: "number", format: "currency", hideInTable: true },
  { name: "health_insurance", label: "건강보험(월 차감액)", type: "number", format: "currency", hideInTable: true },
  { name: "long_term_care_insurance", label: "장기요양보험(월 차감액)", type: "number", format: "currency", hideInTable: true },
  { name: "employment_insurance", label: "고용보험(월 차감액)", type: "number", format: "currency", hideInTable: true },
  { name: "income_tax", label: "소득세(월 차감액)", type: "number", format: "currency", hideInTable: true },
  { name: "local_income_tax", label: "지방소득세(월 차감액)", type: "number", format: "currency", hideInTable: true },
  { name: "rural_tax", label: "농특세(월 차감액)", type: "number", format: "currency", hideInTable: true },
  { name: "memo", label: "메모", type: "textarea", hideInTable: true },
];

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ payslip?: string }>;
}) {
  const { payslip } = await searchParams;
  const supabase = await createClient();
  const [{ data: employees }, { data: payroll }] = await Promise.all([
    supabase.from("employees").select("*").order("created_at", { ascending: false }),
    supabase
      .from("payroll")
      .select("*, employees(name)")
      .order("pay_month", { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className={`text-2xl font-bold text-slate-900 ${payslip ? "print:hidden" : ""}`}>직원 / 급여</h1>

      <div className={payslip ? "space-y-6 print:hidden" : "space-y-6"}>
        <CreatePanel title="직원" fields={employeeFields} createAction={createEmployeeRecord} />

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-900">직원 목록</h2>
          <EntityTable
            fields={employeeFields}
            rows={employees ?? []}
            updateAction={updateEmployeeRecord}
            deleteAction={deleteEmployeeRecord}
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-900">급여 지급 등록</h2>
          <PayrollForm
            employees={(employees ?? []).map((e) => ({
              id: e.id,
              name: e.name,
              monthly_salary: e.monthly_salary,
              national_pension: e.national_pension,
              health_insurance: e.health_insurance,
              long_term_care_insurance: e.long_term_care_insurance,
              employment_insurance: e.employment_insurance,
              income_tax: e.income_tax,
              local_income_tax: e.local_income_tax,
              rural_tax: e.rural_tax,
            }))}
            action={createPayrollRecord}
          />

          <div className="mt-5 overflow-x-auto">
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
                {(payroll ?? []).map((p) => {
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
                          <form action={deletePayrollRecord}>
                            <input type="hidden" name="id" value={p.id} />
                            <button className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50">
                              삭제
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {(payroll ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      급여 지급 기록이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {payslip && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10 print:static print:bg-transparent print:p-0">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl print:max-w-none print:rounded-none print:shadow-none">
            <PayslipView payrollId={payslip} closeHref="/employees" />
          </div>
        </div>
      )}
    </div>
  );
}
