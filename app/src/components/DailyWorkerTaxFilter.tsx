"use client";

import { useRouter } from "next/navigation";
import { fieldClass } from "@/components/ui/field";

export function DailyWorkerTaxFilter({
  years,
  selectedYear,
  selectedMonth,
}: {
  years: number[];
  selectedYear: number;
  selectedMonth: number;
}) {
  const router = useRouter();

  function navigate(year: number, month: number) {
    router.push(`/daily-workers?tab=tax&year=${year}&month=${month}`, { scroll: false });
  }

  return (
    <div className="flex gap-2 print:hidden">
      <select value={selectedYear} onChange={(e) => navigate(Number(e.target.value), selectedMonth)} className={fieldClass}>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}년
          </option>
        ))}
      </select>
      <select value={selectedMonth} onChange={(e) => navigate(selectedYear, Number(e.target.value))} className={fieldClass}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <option key={m} value={m}>
            {m}월
          </option>
        ))}
      </select>
    </div>
  );
}
