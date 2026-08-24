"use client";

import { useMemo, useState } from "react";
import { fieldClass, labelClass } from "@/components/ui/field";

export type SiteOption = { id: string; name: string; client_name: string | null };
export type ProjectOption = {
  id: string;
  name: string;
  site_id: string;
  status: string;
  year: number;
  project_code: string | null;
};

function siteLabel(site: SiteOption | undefined) {
  if (!site) return "미지정 현장";
  return site.client_name ? `${site.client_name} · ${site.name}` : site.name;
}

export function ProjectPicker({
  sites,
  projects,
  value,
  onChange,
}: {
  sites: SiteOption[];
  projects: ProjectOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [showCompleted, setShowCompleted] = useState(false);
  const [year, setYear] = useState("");
  const [siteId, setSiteId] = useState("");

  const siteMap = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);

  const ongoingBySite = useMemo(() => {
    const groups = new Map<string, ProjectOption[]>();
    for (const p of projects) {
      if (p.status !== "ongoing") continue;
      const arr = groups.get(p.site_id) ?? [];
      arr.push(p);
      groups.set(p.site_id, arr);
    }
    return groups;
  }, [projects]);

  const completedProjects = useMemo(() => projects.filter((p) => p.status !== "ongoing"), [projects]);
  const years = useMemo(
    () => Array.from(new Set(completedProjects.map((p) => p.year))).sort((a, b) => b - a),
    [completedProjects]
  );
  const sitesForYear = useMemo(() => {
    if (!year) return [];
    const siteIds = new Set(completedProjects.filter((p) => p.year === Number(year)).map((p) => p.site_id));
    return sites.filter((s) => siteIds.has(s.id));
  }, [completedProjects, sites, year]);
  const projectsForSite = useMemo(
    () =>
      !year || !siteId
        ? []
        : completedProjects.filter((p) => p.year === Number(year) && p.site_id === siteId),
    [completedProjects, year, siteId]
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className={labelClass}>프로젝트 (일반경비는 비워두기)</label>
        <label className="flex items-center gap-1 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => {
              setShowCompleted(e.target.checked);
              setYear("");
              setSiteId("");
            }}
            className="h-3.5 w-3.5 accent-slate-900"
          />
          완료 프로젝트 보기
        </label>
      </div>

      {!showCompleted ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass}>
          <option value="">일반경비</option>
          {Array.from(ongoingBySite.entries()).map(([sId, projs]) => (
            <optgroup key={sId} label={siteLabel(siteMap.get(sId))}>
              {projs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-slate-300 p-2">
          <div className="flex gap-2">
            <select
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                setSiteId("");
              }}
              className={fieldClass}
            >
              <option value="">연도 선택</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className={fieldClass} disabled={!year}>
              <option value="">현장 선택</option>
              {sitesForYear.map((s) => (
                <option key={s.id} value={s.id}>
                  {siteLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <select value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass} disabled={!siteId}>
            <option value="">프로젝트 선택</option>
            {projectsForSite.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.project_code ? ` (${p.project_code})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
