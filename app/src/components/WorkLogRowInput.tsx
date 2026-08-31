"use client";

import { useMemo, useState } from "react";
import { resolveSiteColor } from "@/lib/siteColor";
import { fieldClass } from "@/components/ui/field";

type SiteOption = { id: string; name: string; color: string | null };
export type WorkLogProjectOption = { id: string; name: string; site_id: string; year: number; project_code: string | null };

export function WorkLogRowInput({
  index,
  defaultTitle,
  defaultSiteId,
  defaultProjectId,
  sites,
  projects,
  contentListId,
}: {
  index: number;
  defaultTitle: string;
  defaultSiteId: string;
  defaultProjectId: string;
  sites: SiteOption[];
  projects: WorkLogProjectOption[];
  contentListId: string;
}) {
  const [siteId, setSiteId] = useState(defaultSiteId || "");
  const [projectId, setProjectId] = useState(defaultProjectId || "");
  const selectedSite = sites.find((s) => s.id === siteId);

  const projectsForSite = useMemo(
    () =>
      [...projects.filter((p) => p.site_id === siteId)].sort(
        (a, b) => b.year - a.year || a.name.localeCompare(b.name, "ko")
      ),
    [projects, siteId]
  );
  const projectsByYear = useMemo(() => {
    const map = new Map<number, WorkLogProjectOption[]>();
    for (const p of projectsForSite) {
      const arr = map.get(p.year) ?? [];
      arr.push(p);
      map.set(p.year, arr);
    }
    return Array.from(map.entries());
  }, [projectsForSite]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span
          className="h-6 w-6 shrink-0 rounded-full border border-slate-200"
          style={siteId ? { backgroundColor: resolveSiteColor(siteId, selectedSite?.color) } : { backgroundColor: "#fff" }}
          title={selectedSite?.name ?? "현장 없음"}
        />
        <div className="w-32 shrink-0">
          <select
            name={`site_id_${index}`}
            value={siteId}
            onChange={(e) => {
              setSiteId(e.target.value);
              setProjectId("");
            }}
            className={fieldClass}
          >
            <option value="">현장 없음</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="w-36 shrink-0">
          <select
            name={`project_id_${index}`}
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={!siteId}
            className={fieldClass}
          >
            <option value="">프로젝트 없음</option>
            {projectsByYear.map(([year, projs]) => (
              <optgroup key={year} label={`${year}년`}>
                {projs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.project_code ? ` (${p.project_code})` : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>
      <input
        name={`title_${index}`}
        defaultValue={defaultTitle}
        placeholder={`${index + 1}번째 내용 (예: 파이프공사, 휴무)`}
        list={contentListId}
        className={`${fieldClass} w-full py-3 text-lg`}
      />
    </div>
  );
}
