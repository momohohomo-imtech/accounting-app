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

const employeeFields: FieldConfig[] = [
  { name: "name", label: "이름", required: true },
  { name: "role", label: "직책" },
  { name: "employment_type", label: "고용형태" },
  { name: "hired_date", label: "입사일", type: "date" },
  { name: "phone", label: "연락처", type: "tel" },
];

export default async function EmployeesPage() {
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
      <h1 className="text-2xl font-bold text-slate-900">직원 / 급여</h1>

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
        <form action={createPayrollRecord} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">직원</label>
            <select name="employee_id" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {(employees ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">지급월</label>
            <input type="date" name="pay_month" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">근무일수</label>
            <input type="number" name="work_days" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">지급액</label>
            <input type="number" name="amount" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
              등록
            </button>
          </div>
        </form>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[500px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2 pr-4">직원</th>
                <th className="pb-2 pr-4">지급월</th>
                <th className="pb-2 pr-4">근무일수</th>
                <th className="pb-2 pr-4">지급액</th>
                <th className="pb-2 text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {(payroll ?? []).map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-4 text-slate-700">{p.employees?.name}</td>
                  <td className="py-2 pr-4 text-slate-700">{formatDate(p.pay_month)}</td>
                  <td className="py-2 pr-4 text-slate-700">{p.work_days ?? "-"}</td>
                  <td className="py-2 pr-4 font-medium text-slate-900">{formatWon(p.amount)}</td>
                  <td className="py-2 text-right">
                    <form action={deletePayrollRecord}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50">
                        삭제
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {(payroll ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    급여 지급 기록이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
