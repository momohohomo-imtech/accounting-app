"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fieldClass } from "@/components/ui/field";
import { cx } from "@/lib/cx";

const PRESETS = [
  { label: "전체", value: "1-12" },
  { label: "상반기", value: "1-6" },
  { label: "하반기", value: "7-12" },
];

export function DailyWorkerUsageFilter({
  years,
  selectedYear,
  months,
  clientOptions,
  selectedClient,
}: {
  years: number[];
  selectedYear: number;
  months: string;
  clientOptions: string[];
  selectedClient: string;
}) {
  const router = useRouter();
  const [monthInput, setMonthInput] = useState(months);

  function navigate(year: number, monthsVal: string, clientVal: string) {
    const v = monthsVal.trim() || "1-12";
    setMonthInput(v);
    const clientParam = clientVal ? `&client=${encodeURIComponent(clientVal)}` : "";
    router.push(`/daily-workers?tab=usage&year=${year}&months=${encodeURIComponent(v)}${clientParam}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <select
        value={selectedYear}
        onChange={(e) => navigate(Number(e.target.value), monthInput, selectedClient)}
        className={`${fieldClass} w-20 shrink-0`}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}년
          </option>
        ))}
      </select>
      <div className="flex shrink-0 gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => navigate(selectedYear, p.value, selectedClient)}
            className={cx(
              "shrink-0 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
              monthInput === p.value
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 text-slate-600 hover:bg-slate-100"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <input
        value={monthInput}
        onChange={(e) => setMonthInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && navigate(selectedYear, monthInput, selectedClient)}
        placeholder="예: 1-12"
        className={`${fieldClass} w-20 shrink-0`}
      />
      <button
        type="button"
        onClick={() => navigate(selectedYear, monthInput, selectedClient)}
        className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
      >
        적용
      </button>
      <select
        value={selectedClient}
        onChange={(e) => navigate(selectedYear, monthInput, e.target.value)}
        className={`${fieldClass} w-36 shrink-0`}
      >
        <option value="">전체 거래처</option>
        {clientOptions.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}
