"use client";

import { useRouter } from "next/navigation";

// fieldClass는 w-full이 있어서 flex-nowrap 줄에서 select끼리 폭을 다투다 넘쳐버림 —
// 이 필터는 내용 길이에 맞는 좁은 폭이 필요해 별도 클래스를 쓴다(w-full 없음).
const compactSelectClass =
  "shrink-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 hover:border-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10";

const PERIOD_OPTIONS = [
  { value: "", label: "전체 기간" },
  { value: "q1", label: "1분기 (1~3월)" },
  { value: "q2", label: "2분기 (4~6월)" },
  { value: "q3", label: "3분기 (7~9월)" },
  { value: "q4", label: "4분기 (10~12월)" },
  ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}월` })),
];

export function BankTransactionFilter({
  years,
  selectedYear,
  selectedPeriod,
  showDeposit,
  showWithdrawal,
}: {
  years: number[];
  selectedYear: number;
  selectedPeriod: string;
  showDeposit: boolean;
  showWithdrawal: boolean;
}) {
  const router = useRouter();

  function navigate(year: number | string, period: string, deposit: boolean, withdrawal: boolean) {
    const params = new URLSearchParams({ year: String(year) });
    if (period) params.set("period", period);
    if (!deposit) params.set("deposit", "0");
    if (!withdrawal) params.set("withdrawal", "0");
    router.push(`/bank?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-nowrap items-center gap-2 print:hidden">
      <select
        value={selectedYear}
        onChange={(e) => navigate(e.target.value, selectedPeriod, showDeposit, showWithdrawal)}
        className={compactSelectClass}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}년
          </option>
        ))}
      </select>
      <select
        value={selectedPeriod}
        onChange={(e) => navigate(selectedYear, e.target.value, showDeposit, showWithdrawal)}
        className={compactSelectClass}
      >
        {PERIOD_OPTIONS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      <label className="flex shrink-0 items-center gap-1.5 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={showDeposit}
          onChange={(e) => navigate(selectedYear, selectedPeriod, e.target.checked, showWithdrawal)}
          className="h-3.5 w-3.5"
        />
        입금
      </label>
      <label className="flex shrink-0 items-center gap-1.5 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={showWithdrawal}
          onChange={(e) => navigate(selectedYear, selectedPeriod, showDeposit, e.target.checked)}
          className="h-3.5 w-3.5"
        />
        출금
      </label>
    </div>
  );
}
