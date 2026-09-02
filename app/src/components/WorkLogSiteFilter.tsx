"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { fieldClass } from "@/components/ui/field";

export function WorkLogSiteFilter({
  siteOptions,
  selectedSite,
}: {
  siteOptions: { value: string; label: string }[];
  selectedSite?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <select
      value={selectedSite ?? ""}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        if (e.target.value) params.set("wlSite", e.target.value);
        else params.delete("wlSite");
        router.push(`/reports?${params.toString()}`);
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
