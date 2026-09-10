"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { fieldClass, labelClass } from "@/components/ui/field";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

// 공사 메모 내역을 작성일(연도/월) 기준으로 훑어보는 필터 — 년, 현장, 월 순.
export function ConstructionMemoFilter({
  basePath,
  years,
  selectedYear,
  sites,
  selectedSiteId,
  selectedMonth,
}: {
  basePath: string;
  years: number[];
  selectedYear: string;
  sites: { id: string; name: string }[];
  selectedSiteId: string;
  selectedMonth: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(next: { year?: string; site?: string; month?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    const year = next.year ?? selectedYear;
    const site = next.site ?? selectedSiteId;
    const month = next.month ?? selectedMonth;

    // 연도는 "all"도 명시적으로 URL에 남겨야 함 — 지우면 서버 쪽에서 파라미터가
    // 없는 것과 구분이 안 돼서 기본값(올해)으로 되돌아가 버림.
    params.set("year", year);
    if (site === "all") params.delete("site_id");
    else params.set("site_id", site);
    if (month === "all") params.delete("month");
    else params.set("month", month);

    router.push(`${basePath}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className={labelClass}>연도</label>
        <select value={selectedYear} onChange={(e) => update({ year: e.target.value })} className={fieldClass}>
          <option value="all">전체</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelClass}>현장</label>
        <select value={selectedSiteId} onChange={(e) => update({ site: e.target.value })} className={fieldClass}>
          <option value="all">전체</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelClass}>월</label>
        <select value={selectedMonth} onChange={(e) => update({ month: e.target.value })} className={fieldClass}>
          <option value="all">전체</option>
          {MONTHS.map((m) => (
            <option key={m} value={m}>
              {m}월
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
