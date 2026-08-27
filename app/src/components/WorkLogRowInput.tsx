"use client";

import { useState } from "react";
import { resolveSiteColor } from "@/lib/siteColor";
import { fieldClass } from "@/components/ui/field";

type SiteOption = { id: string; name: string; color: string | null };

export function WorkLogRowInput({
  index,
  defaultTitle,
  defaultSiteId,
  sites,
  contentListId,
}: {
  index: number;
  defaultTitle: string;
  defaultSiteId: string;
  sites: SiteOption[];
  contentListId: string;
}) {
  const [siteId, setSiteId] = useState(defaultSiteId || "");
  const selectedSite = sites.find((s) => s.id === siteId);

  return (
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
          onChange={(e) => setSiteId(e.target.value)}
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
      <input
        name={`title_${index}`}
        defaultValue={defaultTitle}
        placeholder={`${index + 1}번째 내용 (예: 파이프공사, 휴무)`}
        list={contentListId}
        className={`${fieldClass} min-w-0 flex-1`}
      />
    </div>
  );
}
