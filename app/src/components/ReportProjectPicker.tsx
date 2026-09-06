"use client";

import { useRouter } from "next/navigation";
import { fieldClass } from "@/components/ui/field";

export function ReportProjectPicker({
  year,
  site,
  projects,
}: {
  year: number;
  site?: string;
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();

  return (
    <select
      value=""
      onChange={(e) => {
        const id = e.target.value;
        if (!id) return;
        router.push(`/reports?year=${year}${site ? `&site=${site}` : ""}&project=${id}`);
      }}
      className={`${fieldClass} print:hidden`}
    >
      <option value="">프로젝트 찾기…</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
