"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { EMPLOYEE_LINKS, deleteBlockReason, deleteErrorMessage } from "@/lib/deleteGuard";
import { duplicatePayrollNames, monthRangeOf } from "@/lib/payrollDuplicates";
import { one } from "@/lib/relations";

function parse(formData: FormData) {
  return {
    employee_no: String(formData.get("employee_no") ?? "") || null,
    name: String(formData.get("name") ?? ""),
    role: String(formData.get("role") ?? "") || null,
    department: String(formData.get("department") ?? "") || null,
    employment_type: String(formData.get("employment_type") ?? "") || null,
    hired_date: String(formData.get("hired_date") ?? "") || null,
    resigned_date: String(formData.get("resigned_date") ?? "") || null,
    birth_date: String(formData.get("birth_date") ?? "") || null,
    nationality: String(formData.get("nationality") ?? "") || null,
    phone: String(formData.get("phone") ?? "") || null,
    home_phone: String(formData.get("home_phone") ?? "") || null,
    address: String(formData.get("address") ?? "") || null,
    memo: String(formData.get("memo") ?? "") || null,
    emergency1_relation: String(formData.get("emergency1_relation") ?? "") || null,
    emergency1_phone: String(formData.get("emergency1_phone") ?? "") || null,
    emergency2_relation: String(formData.get("emergency2_relation") ?? "") || null,
    emergency2_phone: String(formData.get("emergency2_phone") ?? "") || null,
    monthly_salary: formData.get("monthly_salary") ? Number(formData.get("monthly_salary")) : null,
    national_pension: Number(formData.get("national_pension") ?? 0),
    health_insurance: Number(formData.get("health_insurance") ?? 0),
    long_term_care_insurance: Number(formData.get("long_term_care_insurance") ?? 0),
    employment_insurance: Number(formData.get("employment_insurance") ?? 0),
    income_tax: Number(formData.get("income_tax") ?? 0),
    local_income_tax: Number(formData.get("local_income_tax") ?? 0),
    rural_tax: Number(formData.get("rural_tax") ?? 0),
  };
}

// 저장 실패는 화면에 보이게 { error }로 돌려줌 — 예전엔 오류를 버려서 로그인 만료 등으로 저장이 안 돼도 된 것처럼 보였음.
export async function createEmployeeRecord(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("employees").insert(parse(formData));
  if (error) return { error: error.message };
  revalidatePath("/employees");
}

export async function updateEmployeeRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("employees").update(parse(formData)).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/employees");
}

// 급여 기록이 있는 직원은 막음 — 지우면 급여 기록이 같이 지워짐(DB 규칙).
export async function deleteEmployeeRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const blocked = await deleteBlockReason(
    supabase,
    EMPLOYEE_LINKS,
    id,
    "이 직원에게",
    "퇴사한 직원은 지우지 말고 퇴사일을 넣어 두세요(지우면 급여 기록이 같이 지워짐)."
  );
  if (blocked) return { error: blocked };
  const { error } = await supabase.from("employees").delete().eq("id", id);
  if (error) return { error: deleteErrorMessage(error) };
  revalidatePath("/employees");
}

function parsePayroll(formData: FormData) {
  return {
    employee_id: String(formData.get("employee_id")),
    pay_month: String(formData.get("pay_month")),
    work_days: formData.get("work_days") ? Number(formData.get("work_days")) : null,
    amount: Number(formData.get("amount") ?? 0),
    bonus: Number(formData.get("bonus") ?? 0),
    national_pension: Number(formData.get("national_pension") ?? 0),
    health_insurance: Number(formData.get("health_insurance") ?? 0),
    long_term_care_insurance: Number(formData.get("long_term_care_insurance") ?? 0),
    employment_insurance: Number(formData.get("employment_insurance") ?? 0),
    employment_insurance_refund: Number(formData.get("employment_insurance_refund") ?? 0),
    income_tax: Number(formData.get("income_tax") ?? 0),
    local_income_tax: Number(formData.get("local_income_tax") ?? 0),
    rural_tax: Number(formData.get("rural_tax") ?? 0),
    non_taxable_unreported: Number(formData.get("non_taxable_unreported") ?? 0),
    memo: String(formData.get("memo") ?? "") || null,
  };
}

export async function createPayrollRecord(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("payroll").insert(parsePayroll(formData));
  if (error) return { error: error.message };
  revalidatePath("/employees");
}

export async function updatePayrollRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("payroll").update(parsePayroll(formData)).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/employees");
}

export async function deletePayrollRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("payroll").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/employees");
}

export type PayrollImportRow = {
  employee_id: string;
  pay_month: string;
  amount: number;
  bonus: number;
  national_pension: number;
  health_insurance: number;
  long_term_care_insurance: number;
  employment_insurance: number;
  employment_insurance_refund: number;
  income_tax: number;
  local_income_tax: number;
  rural_tax: number;
};

// 같은 직원·같은 달 급여가 이미 있으면 등록하지 않고 { duplicates: 이름 }을 돌려줌 → 화면에서 확인받고 allowDuplicates로 다시.
// (같은 대장을 두 번 올리면 그 달 급여가 두 번 잡힘 — 상여금처럼 같은 달에 따로 주는 경우가 있어 막지는 않음)
export async function bulkImportPayroll(
  rows: PayrollImportRow[],
  opts: { allowDuplicates?: boolean } = {}
): Promise<{ error?: string; duplicates?: string[] }> {
  try {
    const supabase = await createClient();
    const valid = rows.filter((r) => r.employee_id && r.pay_month);
    if (valid.length === 0) return { error: "등록할 급여가 없습니다." };
    if (!opts.allowDuplicates) {
      const existing: { employee_id: string; pay_month: string; name: string | null }[] = [];
      for (const month of new Set(valid.map((r) => r.pay_month.slice(0, 7)))) {
        const { start, end } = monthRangeOf(month);
        const { data, error } = await supabase
          .from("payroll")
          .select("employee_id, pay_month, employees(name)")
          .in("employee_id", [...new Set(valid.map((r) => r.employee_id))])
          .gte("pay_month", start)
          .lt("pay_month", end);
        if (error) return { error: error.message };
        type Existing = { employee_id: string; pay_month: string; employees: { name: string } | { name: string }[] | null };
        for (const e of (data ?? []) as Existing[]) {
          existing.push({ employee_id: e.employee_id, pay_month: e.pay_month, name: one(e.employees)?.name ?? null });
        }
      }
      const duplicates = duplicatePayrollNames(valid, existing);
      if (duplicates.length > 0) return { duplicates };
    }
    const { error } = await supabase.from("payroll").insert(valid.map((r) => ({ ...r, non_taxable_unreported: 0 })));
    if (error) return { error: error.message };
    revalidatePath("/employees");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
