"use client";

import { useRouter } from "next/navigation";
import { fieldClass } from "@/components/ui/field";

export function YearFilter({
  basePath,
  years,
  selectedYear,
  siteOptions,
  selectedSiteId,
  statusOptions,
  selectedStatus,
}: {
  basePath: string;
  years: number[];
  selectedYear: number;
  siteOptions?: { value: string; label: string }[];
  selectedSiteId?: string;
  statusOptions?: { value: string; label: string }[];
  selectedStatus?: string;
}) {
  const router = useRouter();

  const navigate = (year: number | string, siteId: string, status: string) => {
    const params = new URLSearchParams({ year: String(year) });
    if (siteId) params.set("site_id", siteId);
    if (status) params.set("status", status);
    router.push(`${basePath}?${params.toString()}`);
  };

  return (
    <div className="flex gap-2">
      <select
        value={selectedYear}
        onChange={(e) => navigate(e.target.value, selectedSiteId ?? "", selectedStatus ?? "")}
        className={fieldClass}
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
          onChange={(e) => navigate(selectedYear, e.target.value, selectedStatus ?? "")}
          className={fieldClass}
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
        <select
          value={selectedStatus ?? ""}
          onChange={(e) => navigate(selectedYear, selectedSiteId ?? "", e.target.value)}
          className={fieldClass}
        >
          <option value="">전체 상태</option>
          {statusOptions.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
