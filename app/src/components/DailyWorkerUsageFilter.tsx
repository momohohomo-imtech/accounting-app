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
}: {
  years: number[];
  selectedYear: number;
  months: string;
}) {
  const router = useRouter();
  const [monthInput, setMonthInput] = useState(months);

  function navigate(year: number, monthsVal: string) {
    const v = monthsVal.trim() || "1-12";
    setMonthInput(v);
    router.push(`/daily-workers?tab=usage&year=${year}&months=${encodeURIComponent(v)}`);
  }

  return (
    <div className="flex flex-nowrap items-center gap-2 print:hidden">
      <select
        value={selectedYear}
        onChange={(e) => navigate(Number(e.target.value), monthInput)}
        className={`${fieldClass} shrink-0`}
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
            onClick={() => navigate(selectedYear, p.value)}
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
        onKeyDown={(e) => e.key === "Enter" && navigate(selectedYear, monthInput)}
        placeholder="월 (예: 3 또는 1-12)"
        className={`${fieldClass} w-32 shrink-0`}
      />
      <button
        type="button"
        onClick={() => navigate(selectedYear, monthInput)}
        className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
      >
        적용
      </button>
    </div>
  );
}
