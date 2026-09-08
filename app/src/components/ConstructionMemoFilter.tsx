"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fieldClass, labelClass } from "@/components/ui/field";
import type { ProjectTreeNode } from "@/components/ProjectTreeFilter";

// ProjectTreeFilter와 달리 연도/거래처/현장 선택 단계도 URL에 반영해서, 메모
// 목록이 "선택한 연도 전체 → 선택한 현장 전체 → 선택한 프로젝트만" 순으로
// 점점 좁혀지며 보이게 함(프로젝트를 아직 안 골라도 연도/현장 단위로 모아보기 가능).
export function ConstructionMemoFilter({
  basePath,
  projects,
  selectedYear,
  selectedClient,
  selectedSiteId,
  selectedProjectId,
}: {
  basePath: string;
  projects: ProjectTreeNode[];
  selectedYear: string;
  selectedClient: string;
  selectedSiteId: string;
  selectedProjectId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const years = useMemo(() => {
    const list = Array.from(new Set(projects.map((p) => p.year)));
    // 선택된 연도에 아직 등록된 프로젝트가 없어도(예: 올해 막 시작) 드롭다운에서
    // 사라지지 않게 목록에 끼워넣음.
    const y = Number(selectedYear);
    if (selectedYear !== "all" && !Number.isNaN(y) && !list.includes(y)) list.push(y);
    return list.sort((a, b) => b - a);
  }, [projects, selectedYear]);

  const clientsForYear = useMemo(() => {
    const scoped = selectedYear === "all" ? projects : projects.filter((p) => String(p.year) === selectedYear);
    return Array.from(new Set(scoped.map((p) => p.clientName ?? "미지정")));
  }, [projects, selectedYear]);

  const sitesForClient = useMemo(() => {
    let scoped = projects;
    if (selectedYear !== "all") scoped = scoped.filter((p) => String(p.year) === selectedYear);
    if (selectedClient !== "all") scoped = scoped.filter((p) => (p.clientName ?? "미지정") === selectedClient);
    const map = new Map<string, string>();
    scoped.forEach((p) => map.set(p.siteId, p.siteName));
    return Array.from(map.entries());
  }, [projects, selectedYear, selectedClient]);

  const projectsForSite = useMemo(() => {
    let scoped = projects;
    if (selectedYear !== "all") scoped = scoped.filter((p) => String(p.year) === selectedYear);
    if (selectedClient !== "all") scoped = scoped.filter((p) => (p.clientName ?? "미지정") === selectedClient);
    if (selectedSiteId !== "all") scoped = scoped.filter((p) => p.siteId === selectedSiteId);
    return scoped;
  }, [projects, selectedYear, selectedClient, selectedSiteId]);

  function update(next: { year?: string; client?: string; site?: string; project?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    const year = next.year ?? selectedYear;
    const client = next.client ?? selectedClient;
    const site = next.site ?? selectedSiteId;
    const project = next.project ?? selectedProjectId;

    // 연도는 "all"도 명시적으로 URL에 남겨야 함 — 지우면 서버 쪽에서 파라미터가
    // 없는 것과 구분이 안 돼서 기본값(올해)으로 되돌아가 버림.
    params.set("year", year);
    if (client === "all") params.delete("client");
    else params.set("client", client);
    if (site === "all") params.delete("site_id");
    else params.set("site_id", site);
    if (project) params.set("project_id", project);
    else params.delete("project_id");

    router.push(`${basePath}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className={labelClass}>연도</label>
        <select
          value={selectedYear}
          onChange={(e) => update({ year: e.target.value, client: "all", site: "all", project: "" })}
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
          value={selectedClient}
          onChange={(e) => update({ client: e.target.value, site: "all", project: "" })}
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
        <select
          value={selectedSiteId}
          onChange={(e) => update({ site: e.target.value, project: "" })}
          className={fieldClass}
        >
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
        <select value={selectedProjectId} onChange={(e) => update({ project: e.target.value })} className={fieldClass}>
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
