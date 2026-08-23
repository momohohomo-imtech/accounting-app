"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { fieldClass, labelClass } from "@/components/ui/field";

const MONTH_OPTIONS = [
  { value: "current", label: "이번 달" },
  { value: "all", label: "전체" },
  { value: "h1", label: "상반기 (1~6월)" },
  { value: "h2", label: "하반기 (7~12월)" },
  ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}월` })),
];

export function YearMonthFilter({
  years,
  selectedYear,
  selectedMonth,
}: {
  years: number[];
  selectedYear: number;
  selectedMonth: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`/transactions?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <div className="flex flex-col gap-1">
        <label className={labelClass}>연도</label>
        <select
          value={selectedYear}
          onChange={(e) => setParam("year", e.target.value)}
          className={fieldClass}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelClass}>기간</label>
        <select
          value={selectedMonth}
          onChange={(e) => setParam("month", e.target.value)}
          className={fieldClass}
        >
          {MONTH_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
