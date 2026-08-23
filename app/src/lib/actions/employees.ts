"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parse(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    role: String(formData.get("role") ?? "") || null,
    employment_type: String(formData.get("employment_type") ?? "") || null,
    hired_date: String(formData.get("hired_date") ?? "") || null,
    phone: String(formData.get("phone") ?? "") || null,
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

export async function createPayrollRecord(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("payroll").insert({
    employee_id: String(formData.get("employee_id")),
    pay_month: String(formData.get("pay_month")),
    work_days: formData.get("work_days") ? Number(formData.get("work_days")) : null,
    amount: Number(formData.get("amount") ?? 0),
  });
  revalidatePath("/employees");
}

export async function deletePayrollRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("payroll").delete().eq("id", id);
  revalidatePath("/employees");
}
