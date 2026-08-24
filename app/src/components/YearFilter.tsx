"use client";

import { useRouter } from "next/navigation";
import { fieldClass } from "@/components/ui/field";

export function YearFilter({
  basePath,
  years,
  selectedYear,
}: {
  basePath: string;
  years: number[];
  selectedYear: number;
}) {
  const router = useRouter();

  return (
    <select
      value={selectedYear}
      onChange={(e) => router.push(`${basePath}?year=${e.target.value}`)}
      className={fieldClass}
    >
      {years.map((y) => (
        <option key={y} value={y}>
          {y}년
        </option>
      ))}
    </select>
  );
}
