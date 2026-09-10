"use client";

import { useRouter } from "next/navigation";
import { fieldClass } from "@/components/ui/field";

export function BankTransactionFilter({
  years,
  selectedYear,
  selectedQuarter,
  selectedMonth,
  selectedDirection,
}: {
  years: number[];
  selectedYear: number;
  selectedQuarter: string;
  selectedMonth: string;
  selectedDirection: string;
}) {
  const router = useRouter();

  function navigate(year: number | string, quarter: string, month: string, direction: string) {
    const params = new URLSearchParams({ year: String(year) });
    if (quarter) params.set("quarter", quarter);
    if (month) params.set("month", month);
    if (direction) params.set("direction", direction);
    router.push(`/bank?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <select
        value={selectedYear}
        onChange={(e) => navigate(e.target.value, selectedQuarter, selectedMonth, selectedDirection)}
        className={fieldClass}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}년
          </option>
        ))}
      </select>
      <select
        value={selectedQuarter}
        onChange={(e) => navigate(selectedYear, e.target.value, "", selectedDirection)}
        className={fieldClass}
      >
        <option value="">전체 분기</option>
        <option value="1">1분기 (1~3월)</option>
        <option value="2">2분기 (4~6월)</option>
        <option value="3">3분기 (7~9월)</option>
        <option value="4">4분기 (10~12월)</option>
      </select>
      <select
        value={selectedMonth}
        onChange={(e) => navigate(selectedYear, "", e.target.value, selectedDirection)}
        className={fieldClass}
      >
        <option value="">전체 월</option>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <option key={m} value={m}>
            {m}월
          </option>
        ))}
      </select>
      <select
        value={selectedDirection}
        onChange={(e) => navigate(selectedYear, selectedQuarter, selectedMonth, e.target.value)}
        className={fieldClass}
      >
        <option value="">입금/출금 전체</option>
        <option value="입금">입금만</option>
        <option value="출금">출금만</option>
      </select>
    </div>
  );
}
