"use client";

import { useRouter } from "next/navigation";
import { inlineFieldClass } from "@/components/ui/field";
import { PO_FILTER_LABEL, type PoFilter } from "@/lib/projectPo";

// 보고서 "발주서 발급 현황" 거르기(전체·발급만·미발급만) — 주소 ?po=에 남겨서 인쇄(?printSection=)·엑셀도 거른 그대로.
export function ReportPoFilter({ year, site, value }: { year: number; site?: string; value: PoFilter }) {
  const router = useRouter();
  return (
    <select
      value={value}
      aria-label="발주서 발급 여부로 거르기"
      onChange={(e) => {
        const v = e.target.value as PoFilter;
        const p = new URLSearchParams();
        p.set("year", String(year));
        if (site) p.set("site", site);
        if (v !== "all") p.set("po", v);
        router.push(`/reports?${p.toString()}`, { scroll: false });
      }}
      className={`${inlineFieldClass} print:hidden`}
    >
      {(Object.keys(PO_FILTER_LABEL) as PoFilter[]).map((k) => (
        <option key={k} value={k}>
          {PO_FILTER_LABEL[k]}
        </option>
      ))}
    </select>
  );
}
