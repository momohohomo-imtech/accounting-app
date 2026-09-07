"use client";

import { useRouter } from "next/navigation";
import { fieldClass } from "@/components/ui/field";

const MONTH_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "h1", label: "상반기" },
  { value: "h2", label: "하반기" },
  ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}월` })),
];

export function BusinessTripFilter({
  years,
  selectedYear,
  selectedMonth,
  siteOptions,
  selectedSite,
  projectOptions,
  selectedProject,
}: {
  years: number[];
  selectedYear: number;
  selectedMonth: string;
  siteOptions: string[];
  selectedSite: string;
  projectOptions: string[];
  selectedProject: string;
}) {
  const router = useRouter();

  function navigate(nextYear: number, nextMonth: string, nextSite: string, nextProject: string) {
    const params = new URLSearchParams({ tab: "trip", year: String(nextYear), month: nextMonth });
    if (nextSite) params.set("site", nextSite);
    if (nextProject) params.set("project", nextProject);
    router.push(`/worklogs?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <select
        value={selectedYear}
        onChange={(e) => navigate(Number(e.target.value), selectedMonth, selectedSite, selectedProject)}
        className={fieldClass}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}년
          </option>
        ))}
      </select>
      <select
        value={selectedMonth}
        onChange={(e) => navigate(selectedYear, e.target.value, selectedSite, selectedProject)}
        className={fieldClass}
      >
        {MONTH_OPTIONS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <select
        value={selectedSite}
        onChange={(e) => navigate(selectedYear, selectedMonth, e.target.value, selectedProject)}
        className={fieldClass}
      >
        <option value="">전체 현장</option>
        {siteOptions.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select
        value={selectedProject}
        onChange={(e) => navigate(selectedYear, selectedMonth, selectedSite, e.target.value)}
        className={fieldClass}
      >
        <option value="">전체 프로젝트</option>
        {projectOptions.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </div>
  );
}
