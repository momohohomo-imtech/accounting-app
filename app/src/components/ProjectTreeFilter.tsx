"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fieldClass, labelClass } from "@/components/ui/field";

export type ProjectTreeNode = {
  id: string;
  name: string;
  year: number;
  siteId: string;
  siteName: string;
  clientName: string | null;
};

export function ProjectTreeFilter({
  basePath,
  projects,
  selectedProjectId,
}: {
  basePath: string;
  projects: ProjectTreeNode[];
  selectedProjectId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = projects.find((p) => p.id === selectedProjectId);

  const [year, setYear] = useState(selected ? String(selected.year) : "all");
  const [clientName, setClientName] = useState(selected?.clientName ?? "all");
  const [siteId, setSiteId] = useState(selected?.siteId ?? "all");

  const years = useMemo(() => Array.from(new Set(projects.map((p) => p.year))).sort((a, b) => b - a), [projects]);

  const clientsForYear = useMemo(() => {
    const scoped = year === "all" ? projects : projects.filter((p) => String(p.year) === year);
    return Array.from(new Set(scoped.map((p) => p.clientName ?? "미지정")));
  }, [projects, year]);

  const sitesForClient = useMemo(() => {
    let scoped = projects;
    if (year !== "all") scoped = scoped.filter((p) => String(p.year) === year);
    if (clientName !== "all") scoped = scoped.filter((p) => (p.clientName ?? "미지정") === clientName);
    const map = new Map<string, string>();
    scoped.forEach((p) => map.set(p.siteId, p.siteName));
    return Array.from(map.entries());
  }, [projects, year, clientName]);

  const projectsForSite = useMemo(() => {
    let scoped = projects;
    if (year !== "all") scoped = scoped.filter((p) => String(p.year) === year);
    if (clientName !== "all") scoped = scoped.filter((p) => (p.clientName ?? "미지정") === clientName);
    if (siteId !== "all") scoped = scoped.filter((p) => p.siteId === siteId);
    return scoped;
  }, [projects, year, clientName, siteId]);

  function goToProject(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("project_id", id);
    else params.delete("project_id");
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className={labelClass}>연도</label>
        <select
          value={year}
          onChange={(e) => {
            setYear(e.target.value);
            setClientName("all");
            setSiteId("all");
          }}
          className={fieldClass}
        >
          <option value="all">전체</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelClass}>거래처</label>
        <select
          value={clientName}
          onChange={(e) => {
            setClientName(e.target.value);
            setSiteId("all");
          }}
          className={fieldClass}
        >
          <option value="all">전체</option>
          {clientsForYear.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelClass}>현장</label>
        <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className={fieldClass}>
          <option value="all">전체</option>
          {sitesForClient.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelClass}>프로젝트</label>
        <select value={selectedProjectId} onChange={(e) => goToProject(e.target.value)} className={fieldClass}>
          <option value="">전체 프로젝트</option>
          {projectsForSite.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
