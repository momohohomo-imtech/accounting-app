"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { fieldClass } from "@/components/ui/field";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export function UnassignedWorkLogMonthFilter({ value }: { value?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <select
      value={value ?? ""}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        if (e.target.value) params.set("unassignedMonth", e.target.value);
        else params.delete("unassignedMonth");
        router.push(`/reports?${params.toString()}`);
      }}
      className={`${fieldClass} print:hidden`}
    >
      <option value="">전체 월</option>
      {MONTHS.map((m) => (
        <option key={m} value={String(m)}>
          {m}월
        </option>
      ))}
    </select>
  );
}
