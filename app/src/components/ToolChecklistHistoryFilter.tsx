"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { fieldClass } from "@/components/ui/field";

const MONTH_OPTIONS = [
  { value: "all", label: "전체" },
  ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}월` })),
];

export function ToolChecklistHistoryFilter({
  basePath,
  years,
  selectedYear,
  selectedMonth,
  sites,
  selectedSiteId,
}: {
  basePath: string;
  years: number[];
  selectedYear: string;
  selectedMonth: string;
  sites: { id: string; name: string }[];
  selectedSiteId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(next: { year?: string; month?: string; site?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    const year = next.year ?? selectedYear;
    const month = next.month ?? selectedMonth;
    const site = next.site ?? selectedSiteId;

    // "전체"도 명시적으로 URL에 남겨야 함 — 지우면 파라미터 없음과 구분이 안 돼서
    // 서버 쪽 기본값(이번 달)으로 되돌아가 버림.
    params.set("historyYear", year);
    params.set("historyMonth", month);
    if (site === "all") params.delete("historySite");
    else params.set("historySite", site);

    router.push(`${basePath}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <select
        value={selectedYear}
        onChange={(e) => update({ year: e.target.value })}
        className={`${fieldClass} w-auto`}
        aria-label="연도"
      >
        <option value="all">전체 연도</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}년
          </option>
        ))}
      </select>
      <select
        value={selectedMonth}
        onChange={(e) => update({ month: e.target.value })}
        className={`${fieldClass} w-auto`}
        aria-label="월"
      >
        {MONTH_OPTIONS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <select
        value={selectedSiteId}
        onChange={(e) => update({ site: e.target.value })}
        className={`${fieldClass} w-auto`}
        aria-label="현장"
      >
        <option value="all">전체 현장</option>
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}
