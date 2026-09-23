import { createClient } from "@/lib/supabase/server";
import { PayslipCertificate } from "@/components/PayslipCertificate";

export async function PayslipView({ payrollId, closeHref }: { payrollId: string; closeHref: string }) {
  const supabase = await createClient();
  const { data: p } = await supabase.from("payroll").select("*, employees(*)").eq("id", payrollId).single();
  if (!p) return null;

  const e = p.employees;
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

  const deductionRows: [string, number][] = [
    ["국민연금", p.national_pension],
    ["건강보험", p.health_insurance],
    ["장기요양보험", p.long_term_care_insurance],
    ["고용보험", p.employment_insurance],
    ...(p.employment_insurance_refund ? ([["환급금", -p.employment_insurance_refund]] as [string, number][]) : []),
    ["소득세", p.income_tax],
    ["지방소득세", p.local_income_tax],
    ["농특세", p.rural_tax],
  ];

  return (
    <PayslipCertificate
      closeHref={closeHref}
      data={{
        payMonth: p.pay_month,
        employeeName: e?.name ?? "-",
        employeeNo: e?.employee_no ?? null,
        department: e?.department ?? null,
        role: e?.role ?? null,
        hiredDate: e?.hired_date ?? null,
        resignedDate: e?.resigned_date ?? null,
        amount: p.amount,
        bonus: p.bonus,
        total,
        deductionRows,
        deductionTotal,
        nonTaxableUnreported: p.non_taxable_unreported,
        net,
        memo: p.memo ?? null,
      }}
    />
  );
}
