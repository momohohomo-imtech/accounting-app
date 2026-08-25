"use client";

import { useRouter } from "next/navigation";
import { fieldClass } from "@/components/ui/field";

export function ReportProjectSiteFilter({
  year,
  siteOptions,
  selectedSite,
}: {
  year: number;
  siteOptions: { value: string; label: string }[];
  selectedSite?: string;
}) {
  const router = useRouter();

  return (
    <select
      value={selectedSite ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        router.push(`/reports?year=${year}${v ? `&site=${v}` : ""}`);
      }}
      className={`${fieldClass} print:hidden`}
    >
      <option value="">전체 현장</option>
      {siteOptions.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
