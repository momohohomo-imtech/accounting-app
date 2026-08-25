"use client";

import { useState } from "react";
import { fieldClass, labelClass } from "@/components/ui/field";
import { formatWon } from "@/lib/format";
import { Button } from "@/components/ui/Button";

type EmployeeOption = {
  id: string;
  name: string;
  monthly_salary: number | null;
  national_pension: number;
  health_insurance: number;
  long_term_care_insurance: number;
  employment_insurance: number;
  income_tax: number;
  local_income_tax: number;
  rural_tax: number;
};

type Values = {
  amount: string;
  bonus: string;
  national_pension: string;
  health_insurance: string;
  long_term_care_insurance: string;
  employment_insurance: string;
  income_tax: string;
  local_income_tax: string;
  rural_tax: string;
  non_taxable_unreported: string;
};

function defaultsFor(e?: EmployeeOption): Values {
  return {
    amount: e?.monthly_salary != null ? String(e.monthly_salary) : "",
    bonus: "0",
    national_pension: String(e?.national_pension ?? 0),
    health_insurance: String(e?.health_insurance ?? 0),
    long_term_care_insurance: String(e?.long_term_care_insurance ?? 0),
    employment_insurance: String(e?.employment_insurance ?? 0),
    income_tax: String(e?.income_tax ?? 0),
    local_income_tax: String(e?.local_income_tax ?? 0),
    rural_tax: String(e?.rural_tax ?? 0),
    non_taxable_unreported: "0",
  };
}

export function PayrollForm({
  employees,
  action,
}: {
  employees: EmployeeOption[];
  action: (formData: FormData) => void;
}) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [values, setValues] = useState<Values>(() => defaultsFor(employees[0]));

  function handleEmployeeChange(id: string) {
    setEmployeeId(id);
    setValues(defaultsFor(employees.find((e) => e.id === id)));
  }

  function set<K extends keyof Values>(key: K, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  const total = (Number(values.amount) || 0) + (Number(values.bonus) || 0);
  const deductionTotal =
    (Number(values.national_pension) || 0) +
    (Number(values.health_insurance) || 0) +
    (Number(values.long_term_care_insurance) || 0) +
    (Number(values.employment_insurance) || 0) +
    (Number(values.income_tax) || 0) +
    (Number(values.local_income_tax) || 0) +
    (Number(values.rural_tax) || 0);
  const net = total - deductionTotal + (Number(values.non_taxable_unreported) || 0);

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="직원">
          <select
            name="employee_id"
            value={employeeId}
            onChange={(e) => handleEmployeeChange(e.target.value)}
            required
            className={fieldClass}
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="지급월">
          <input type="date" name="pay_month" required className={fieldClass} />
        </Field>
        <Field label="근무일수">
          <input type="number" name="work_days" className={fieldClass} />
        </Field>
        <Field label="기본급(월급)">
          <input
            type="number"
            name="amount"
            value={values.amount}
            onChange={(e) => set("amount", e.target.value)}
            required
            className={fieldClass}
          />
        </Field>
        <Field label="상여">
          <input type="number" name="bonus" value={values.bonus} onChange={(e) => set("bonus", e.target.value)} className={fieldClass} />
        </Field>
        <Field label="국민연금">
          <input
            type="number"
            name="national_pension"
            value={values.national_pension}
            onChange={(e) => set("national_pension", e.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field label="건강보험">
          <input
            type="number"
            name="health_insurance"
            value={values.health_insurance}
            onChange={(e) => set("health_insurance", e.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field label="장기요양보험">
          <input
            type="number"
            name="long_term_care_insurance"
            value={values.long_term_care_insurance}
            onChange={(e) => set("long_term_care_insurance", e.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field label="고용보험">
          <input
            type="number"
            name="employment_insurance"
            value={values.employment_insurance}
            onChange={(e) => set("employment_insurance", e.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field label="소득세">
          <input
            type="number"
            name="income_tax"
            value={values.income_tax}
            onChange={(e) => set("income_tax", e.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field label="지방소득세">
          <input
            type="number"
            name="local_income_tax"
            value={values.local_income_tax}
            onChange={(e) => set("local_income_tax", e.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field label="농특세">
          <input
            type="number"
            name="rural_tax"
            value={values.rural_tax}
            onChange={(e) => set("rural_tax", e.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field label="미제출비과세">
          <input
            type="number"
            name="non_taxable_unreported"
            value={values.non_taxable_unreported}
            onChange={(e) => set("non_taxable_unreported", e.target.value)}
            className={fieldClass}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-4 rounded-lg bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
        <span>
          지급합계 <b className="font-mono text-slate-900">{formatWon(total)}</b>
        </span>
        <span>
          공제합계 <b className="font-mono text-slate-900">{formatWon(deductionTotal)}</b>
        </span>
        <span>
          차인지급액 <b className="font-mono text-slate-900">{formatWon(net)}</b>
        </span>
      </div>

      <Button type="submit">등록</Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}
