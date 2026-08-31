"use client";

import { useMemo, useState } from "react";
import { resolveSiteColor } from "@/lib/siteColor";
import { fieldClass } from "@/components/ui/field";
import { WorkLogProjectPicker } from "@/components/WorkLogProjectPicker";

type SiteOption = { id: string; name: string; color: string | null };
export type WorkLogProjectOption = {
  id: string;
  name: string;
  site_id: string;
  year: number;
  project_code: string | null;
  status: string;
};

export function WorkLogRowInput({
  index,
  defaultTitle,
  defaultSiteId,
  defaultProjectId,
  defaultYear,
  sites,
  projects,
  contentListId,
}: {
  index: number;
  defaultTitle: string;
  defaultSiteId: string;
  defaultProjectId: string;
  defaultYear: number;
  sites: SiteOption[];
  projects: WorkLogProjectOption[];
  contentListId: string;
}) {
  const [siteId, setSiteId] = useState(defaultSiteId || "");
  const [projectId, setProjectId] = useState(defaultProjectId || "");
  const selectedSite = sites.find((s) => s.id === siteId);

  const projectsForSite = useMemo(() => projects.filter((p) => p.site_id === siteId), [projects, siteId]);

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
        <input type="hidden" name={`project_id_${index}`} value={projectId} />
        <div className="w-40 shrink-0">
          {siteId ? (
            <WorkLogProjectPicker projects={projectsForSite} value={projectId} onChange={setProjectId} defaultYear={defaultYear} />
          ) : (
            <span className={`${fieldClass} block truncate text-slate-400`}>현장 먼저 선택</span>
          )}
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
