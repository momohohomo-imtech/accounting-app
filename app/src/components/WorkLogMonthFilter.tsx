"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fieldClass } from "@/components/ui/field";
import { cx } from "@/lib/cx";

export function WorkLogMonthFilter({ year, month }: { year: number; month: number }) {
  const router = useRouter();
  const [yearInput, setYearInput] = useState(String(year));

  const goToYear = () => {
    const y = Number(yearInput);
    if (!Number.isInteger(y) || y < 1900 || y > 9999) {
      setYearInput(String(year));
      return;
    }
    if (y !== year) router.push(`/worklogs?year=${y}&month=${month}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={yearInput}
          onChange={(e) => setYearInput(e.target.value)}
          onBlur={goToYear}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              goToYear();
            }
          }}
          className={cx(fieldClass, "w-24")}
        />
        <span className="text-sm text-slate-500">년</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => router.push(`/worklogs?year=${year}&month=${m}`)}
            className={cx(
              "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
              m === month ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-100"
            )}
          >
            {m}월
          </button>
        ))}
      </div>
    </div>
  );
}
