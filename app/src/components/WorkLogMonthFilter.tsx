"use client";

import { useRouter } from "next/navigation";
import { fieldClass } from "@/components/ui/field";

export function WorkLogMonthFilter({ year, month, years }: { year: number; month: number; years: number[] }) {
  const router = useRouter();

  const navigate = (y: number, m: number) => router.push(`/worklogs?year=${y}&month=${m}`);

  return (
    <div className="flex gap-2">
      <select value={year} onChange={(e) => navigate(Number(e.target.value), month)} className={fieldClass}>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}년
          </option>
        ))}
      </select>
      <select value={month} onChange={(e) => navigate(year, Number(e.target.value))} className={fieldClass}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <option key={m} value={m}>
            {m}월
          </option>
        ))}
      </select>
    </div>
  );
}
