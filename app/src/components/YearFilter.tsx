"use client";

import { useRouter } from "next/navigation";
import { fieldClass } from "@/components/ui/field";

export function YearFilter({
  basePath,
  years,
  selectedYear,
  siteOptions,
  selectedSiteId,
}: {
  basePath: string;
  years: number[];
  selectedYear: number;
  siteOptions?: { value: string; label: string }[];
  selectedSiteId?: string;
}) {
  const router = useRouter();

  const navigate = (year: number | string, siteId: string) => {
    const params = new URLSearchParams({ year: String(year) });
    if (siteId) params.set("site_id", siteId);
    router.push(`${basePath}?${params.toString()}`);
  };

  return (
    <div className="flex gap-2">
      <select
        value={selectedYear}
        onChange={(e) => navigate(e.target.value, selectedSiteId ?? "")}
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
          onChange={(e) => navigate(selectedYear, e.target.value)}
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
    </div>
  );
}
