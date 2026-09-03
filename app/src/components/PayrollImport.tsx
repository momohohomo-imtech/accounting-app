"use client";

import { useState } from "react";
import { fieldClass, labelClass } from "@/components/ui/field";
import { formatWon } from "@/lib/format";
import { cx } from "@/lib/cx";
import { Button } from "@/components/ui/Button";
import { bulkImportPayroll } from "@/lib/actions/employees";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

type EmployeeRef = { id: string; employee_no: string | null; name: string };

const NUMERIC_KEYS = [
  "amount",
  "bonus",
  "national_pension",
  "health_insurance",
  "long_term_care_insurance",
  "employment_insurance",
  "employment_insurance_refund",
  "income_tax",
  "local_income_tax",
  "rural_tax",
] as const;

type NumericKey = (typeof NUMERIC_KEYS)[number];

type ParsedRow = Record<NumericKey, number> & { employee_no: string; net_pay?: number };
type EditableRow = ParsedRow & { employeeId: string };

const COLUMN_LABELS: Record<NumericKey, string> = {
  amount: "기본급/상여성지급액",
  bonus: "상여",
  national_pension: "국민연금",
  health_insurance: "건강보험",
  long_term_care_insurance: "장기요양보험",
  employment_insurance: "고용보험",
  employment_insurance_refund: "고용보험환급",
  income_tax: "소득세",
  local_income_tax: "지방소득세",
  rural_tax: "농특세",
};

function netOf(r: EditableRow) {
  const total = r.amount + r.bonus;
  const deduction =
    r.national_pension +
    r.health_insurance +
    r.long_term_care_insurance +
    r.employment_insurance +
    r.income_tax +
    r.local_income_tax +
    r.rural_tax -
    r.employment_insurance_refund;
  return total - deduction;
}

export function PayrollImport({ employees }: { employees: EmployeeRef[] }) {
  const [payMonth, setPayMonth] = useState("");
  const confirm = useConfirm();
  const pending = useGlobalPending();
  const [rows, setRows] = useState<EditableRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    setRows(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/payroll-ocr", { method: "POST", body: fd });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
        return;
      }
      const extracted = json.extracted as { pay_month?: string; rows?: ParsedRow[] } | null;
      if (!extracted?.rows?.length) {
        setError("표를 인식하지 못했습니다.");
        return;
      }
      setPayMonth(extracted.pay_month ?? "");
      setRows(
        extracted.rows.map((r) => ({
          ...r,
          employeeId:
            employees.find((e) => e.employee_no && e.employee_no.trim() === String(r.employee_no ?? "").trim())?.id ?? "",
        }))
      );
    } catch {
      setError("인식 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function updateRow(i: number, patch: Partial<EditableRow>) {
    setRows((prev) => prev?.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) ?? null);
  }

  async function handleSave() {
    if (!rows || !payMonth) return;
    if (rows.some((r) => !r.employeeId)) {
      setError("직원이 지정되지 않은 행이 있습니다. 모든 행에 직원을 선택해주세요.");
      return;
    }
    if (!(await confirm(`${rows.length}건을 ${payMonth} 급여로 등록하시겠습니까?`))) return;

    setSaving(true);
    setError(null);
    try {
      await pending.run(() =>
        bulkImportPayroll(
          rows.map((r) => ({
            employee_id: r.employeeId,
            pay_month: payMonth,
            amount: r.amount,
            bonus: r.bonus,
            national_pension: r.national_pension,
            health_insurance: r.health_insurance,
            long_term_care_insurance: r.long_term_care_insurance,
            employment_insurance: r.employment_insurance,
            employment_insurance_refund: r.employment_insurance_refund,
            income_tax: r.income_tax,
            local_income_tax: r.local_income_tax,
            rural_tax: r.rural_tax,
          }))
        )
      );
      setRows(null);
      setPayMonth("");
    } catch {
      setError("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        급여대장/상여대장 PDF·이미지·엑셀을 올리면 AI가 표를 읽어서 아래에 미리보기로 보여줘요. 한 파일에 여러
        직원이 들어있어도 전부 인식해요. 값을 확인·수정한 뒤 일괄 등록하세요.
      </p>
      <input
        type="file"
        accept="application/pdf,image/*,.xlsx,.xls"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        className="text-sm"
      />
      {loading && <p className="text-sm text-slate-500">AI가 표를 인식하는 중입니다...</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {rows && rows.length > 0 && (
        <div className="space-y-3">
          <div className="max-w-xs">
            <label className={labelClass}>지급월</label>
            <input type="date" value={payMonth} onChange={(e) => setPayMonth(e.target.value)} className={fieldClass} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-2 pr-2">직원</th>
                  {NUMERIC_KEYS.map((k) => (
                    <th key={k} className="pb-2 pr-2 whitespace-nowrap">
                      {COLUMN_LABELS[k]}
                    </th>
                  ))}
                  <th className="pb-2 pr-2 text-right">차인지급액(계산)</th>
                  <th className="pb-2 text-right">문서상 금액</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const net = netOf(r);
                  const mismatch = r.net_pay != null && Math.abs(net - r.net_pay) > 1;
                  return (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-1 pr-2">
                        <select
                          value={r.employeeId}
                          onChange={(e) => updateRow(i, { employeeId: e.target.value })}
                          className={cx(fieldClass, "min-w-[140px]")}
                        >
                          <option value="">사원번호 {r.employee_no} - 선택</option>
                          {employees.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      {NUMERIC_KEYS.map((key) => (
                        <td key={key} className="py-1 pr-2">
                          <input
                            type="number"
                            value={r[key]}
                            onChange={(e) => updateRow(i, { [key]: Number(e.target.value) } as Partial<EditableRow>)}
                            className={cx(fieldClass, "w-24")}
                          />
                        </td>
                      ))}
                      <td className="py-1 pr-2 text-right font-mono">{formatWon(net)}</td>
                      <td className={cx("py-1 text-right font-mono", mismatch && "font-semibold text-red-600")}>
                        {r.net_pay != null ? formatWon(r.net_pay) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? "저장 중..." : `${rows.length}건 일괄 등록`}
          </Button>
        </div>
      )}
    </div>
  );
}
