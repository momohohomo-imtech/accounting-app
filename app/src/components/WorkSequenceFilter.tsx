"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { inlineFieldClass } from "@/components/ui/field";
import { SEQ_FILTER_ALL } from "@/lib/workSequenceFilter";

// 공사 작업 순서 연도·현장 필터(사용자 요청 11/4, 기본 올해·현장 전체 — lib/workSequenceFilter.ts). 할 일·팀별 일정·순서표 목록에 같이 적용.
export function WorkSequenceFilter({
  basePath,
  years,
  selectedYear,
  sites,
  selectedSite,
}: {
  basePath: string;
  years: number[];
  /** "all" 또는 연도 */
  selectedYear: string;
  /** 현장 미지정은 "none" */
  sites: { id: string; name: string }[];
  selectedSite: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(next: { year?: string; site?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    // 연도는 "전체"도 주소에 남김 — 지우면 기본값(올해)과 구분이 안 됨
    params.set("seqYear", next.year ?? selectedYear);
    const site = next.site ?? selectedSite;
    if (site === SEQ_FILTER_ALL) params.delete("seqSite");
    else params.set("seqSite", site);
    // 열린 순서표 팝업 주소는 빼고(필터만 바꿈)
    params.delete("seq");
    params.delete("copyFrom");
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
        <option value={SEQ_FILTER_ALL}>전체 연도</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}년
          </option>
        ))}
      </select>
      <select
        value={selectedSite}
        onChange={(e) => update({ site: e.target.value })}
        className={`${inlineFieldClass} max-w-full`}
        aria-label="현장"
      >
        <option value={SEQ_FILTER_ALL}>전체 현장</option>
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}
