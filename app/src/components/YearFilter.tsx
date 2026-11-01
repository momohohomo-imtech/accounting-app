"use client";

import { useRouter } from "next/navigation";
import { inlineFieldClass } from "@/components/ui/field";
import { statusFilterCookieValue } from "@/lib/projectStatusFilter";

export function YearFilter({
  basePath,
  years,
  selectedYear,
  siteOptions,
  selectedSiteId,
  statusOptions,
  selectedStatuses,
  extraParams,
  rememberStatusCookie,
}: {
  basePath: string;
  years: number[];
  selectedYear: number;
  siteOptions?: { value: string; label: string }[];
  selectedSiteId?: string;
  statusOptions?: { value: string; label: string }[];
  /** 체크된 상태 값들 — 비어있으면 전체 상태(필터 없음). */
  selectedStatuses?: string[];
  /** 주소에 함께 남길 값(예: 탭 { tab: "check" }). */
  extraParams?: Record<string, string>;
  /** 상태 체크를 이 이름의 쿠키에 저장(다음에 열 때 그 상태만 — 프로젝트 목록, lib/projectStatusFilter.ts). */
  rememberStatusCookie?: string;
}) {
  const router = useRouter();
  const statuses = selectedStatuses ?? [];

  const navigate = (year: number | string, siteId: string, statusList: string[]) => {
    const params = new URLSearchParams({ ...extraParams, year: String(year) });
    if (siteId) params.set("site_id", siteId);
    if (statusList.length > 0) params.set("status", statusList.join(","));
    router.push(`${basePath}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={selectedYear}
        onChange={(e) => navigate(e.target.value, selectedSiteId ?? "", statuses)}
        className={inlineFieldClass}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}년
          </option>
        ))}
      </select>
      {siteOptions && (
        <select
          value={selectedSiteId ?? ""}
          onChange={(e) => navigate(selectedYear, e.target.value, statuses)}
          className={inlineFieldClass}
        >
          <option value="">전체 현장</option>
          {siteOptions.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      )}
      {statusOptions && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5">
          {statusOptions.map((s) => {
            const checked = statuses.includes(s.value);
            return (
              <label key={s.value} className="flex items-center gap-1 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...statuses, s.value]
                      : statuses.filter((v) => v !== s.value);
                    // 화면을 다시 불러오기 전에 저장 — 서버가 새 쿠키를 받아 다음 방문부터 그 상태만 조회(1년 보관).
                    if (rememberStatusCookie) {
                      document.cookie = `${rememberStatusCookie}=${statusFilterCookieValue(next)}; path=/; max-age=31536000; samesite=lax`;
                    }
                    navigate(selectedYear, selectedSiteId ?? "", next);
                  }}
                  className="h-3.5 w-3.5"
                />
                {s.label}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
