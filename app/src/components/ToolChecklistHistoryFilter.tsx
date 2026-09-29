"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { inlineFieldClass } from "@/components/ui/field";

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
  currentYear,
  recentCount,
}: {
  basePath: string;
  years: number[];
  // "recent" = 기본(최근 작성 recentCount건), "all" = 전체 연도, 그 외 연도 숫자
  selectedYear: string;
  selectedMonth: string;
  sites: { id: string; name: string }[];
  selectedSiteId: string;
  currentYear: number;
  recentCount: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(next: { year?: string; month?: string; site?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    let year = next.year ?? selectedYear;
    const month = next.month ?? selectedMonth;
    const site = next.site ?? selectedSiteId;
    // "최근 N건" 상태에서 월을 고르면 올해 그 달로.
    if (year === "recent" && next.month && next.month !== "all") year = String(currentYear);

    // 기본(최근 N건)은 파라미터 없음. 연도("전체" 포함)를 고르면 연/월을 URL에 남겨서 기본과 구분.
    if (year === "recent") {
      params.delete("historyYear");
      params.delete("historyMonth");
    } else {
      params.set("historyYear", year);
      params.set("historyMonth", month);
    }
    if (site === "all") params.delete("historySite");
    else params.set("historySite", site);

    router.push(`${basePath}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <select
        value={selectedYear}
        onChange={(e) => update({ year: e.target.value })}
        className={`${inlineFieldClass} max-w-full`}
        aria-label="연도"
      >
        <option value="recent">최근 {recentCount}건</option>
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
        className={`${inlineFieldClass} max-w-full`}
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
        className={`${inlineFieldClass} max-w-full`}
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
