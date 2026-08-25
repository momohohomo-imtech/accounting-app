"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parse(formData: FormData) {
  return {
    employee_no: String(formData.get("employee_no") ?? "") || null,
    name: String(formData.get("name") ?? ""),
    role: String(formData.get("role") ?? "") || null,
    department: String(formData.get("department") ?? "") || null,
    employment_type: String(formData.get("employment_type") ?? "") || null,
    hired_date: String(formData.get("hired_date") ?? "") || null,
    resigned_date: String(formData.get("resigned_date") ?? "") || null,
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

export async function createEmployeeRecord(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("employees").insert(parse(formData));
  revalidatePath("/employees");
}

export async function updateEmployeeRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("employees").update(parse(formData)).eq("id", id);
  revalidatePath("/employees");
}

export async function deleteEmployeeRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("employees").delete().eq("id", id);
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
  await supabase.from("payroll").insert(parsePayroll(formData));
  revalidatePath("/employees");
}

export async function updatePayrollRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("payroll").update(parsePayroll(formData)).eq("id", id);
  revalidatePath("/employees");
}

export async function deletePayrollRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("payroll").delete().eq("id", id);
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

export async function bulkImportPayroll(rows: PayrollImportRow[]) {
  const supabase = await createClient();
  const valid = rows.filter((r) => r.employee_id && r.pay_month);
  if (valid.length) {
    await supabase.from("payroll").insert(valid.map((r) => ({ ...r, non_taxable_unreported: 0 })));
  }
  revalidatePath("/employees");
}
