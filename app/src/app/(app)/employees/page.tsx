import { createClient } from "@/lib/supabase/server";
import { CreatePanel } from "@/components/crud/CreatePanel";
import { EntityTable } from "@/components/crud/EntityTable";
import {
  createEmployeeRecord,
  updateEmployeeRecord,
  deleteEmployeeRecord,
  createPayrollRecord,
  updatePayrollRecord,
  deletePayrollRecord,
} from "@/lib/actions/employees";
import type { FieldConfig } from "@/components/crud/types";
import { PayrollForm } from "@/components/PayrollForm";
import { PayrollTable } from "@/components/PayrollTable";
import { PayrollImport } from "@/components/PayrollImport";
import { PayslipView } from "@/components/PayslipView";
import { YearFilter } from "@/components/YearFilter";

const employeeFields: FieldConfig[] = [
  { name: "employee_no", label: "사원번호" },
  { name: "name", label: "이름", required: true },
  { name: "role", label: "직위" },
  { name: "department", label: "부서" },
  { name: "employment_type", label: "고용형태" },
  { name: "hired_date", label: "입사일", type: "date" },
  { name: "resigned_date", label: "퇴사일", type: "date", hideInTable: true },
  { name: "birth_date", label: "생년월일", type: "date", hideInTable: true },
  { name: "nationality", label: "국적", hideInTable: true },
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
  searchParams: Promise<{ payslip?: string; year?: string }>;
}) {
  const { payslip, year } = await searchParams;
  const currentYear = new Date().getFullYear();
  const selectedYear = year ? Number(year) : currentYear;
  const yearStart = `${selectedYear}-01-01`;
  const yearEnd = `${selectedYear}-12-31`;

  const supabase = await createClient();
  const [{ data: employees }, { data: payroll }, { data: firstPayroll }] = await Promise.all([
    supabase.from("employees").select("*").order("created_at", { ascending: false }),
    supabase
      .from("payroll")
      .select("*, employees(name)")
      .gte("pay_month", yearStart)
      .lte("pay_month", yearEnd)
      .order("pay_month", { ascending: false }),
    supabase.from("payroll").select("pay_month").order("pay_month", { ascending: true }).limit(1),
  ]);

  const firstYear = Math.min(
    firstPayroll?.[0]?.pay_month ? Number(firstPayroll[0].pay_month.slice(0, 4)) : currentYear,
    currentYear
  );
  const payrollYears = Array.from({ length: currentYear - firstYear + 1 }, (_, i) => currentYear - i);
  if (!payrollYears.includes(selectedYear)) payrollYears.unshift(selectedYear);
  payrollYears.sort((a, b) => b - a);

  const employeeOptions = (employees ?? []).map((e) => ({
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
  }));

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
          <h2 className="mb-3 font-semibold text-slate-900">급여대장/상여대장 업로드 (AI 자동 인식)</h2>
          <PayrollImport
            employees={(employees ?? []).map((e) => ({ id: e.id, employee_no: e.employee_no, name: e.name }))}
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-900">급여 지급 등록</h2>
          <PayrollForm employees={employeeOptions} action={createPayrollRecord} />

          <div className="mb-3 mt-6 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">급여 지급 이력</h3>
            <YearFilter basePath="/employees" years={payrollYears} selectedYear={selectedYear} />
          </div>

          <div className="overflow-x-auto">
            <PayrollTable
              payroll={payroll ?? []}
              employees={employeeOptions}
              year={selectedYear}
              updateAction={updatePayrollRecord}
              deleteAction={deletePayrollRecord}
            />
          </div>
        </div>
      </div>

      {payslip && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-10 print:static print:p-0">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl print:max-w-none print:rounded-none print:border-0 print:shadow-none">
            <PayslipView payrollId={payslip} closeHref={`/employees?year=${selectedYear}`} />
          </div>
        </div>
      )}
    </div>
  );
}
