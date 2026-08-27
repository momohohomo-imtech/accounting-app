"use client";

import { useState } from "react";
import { siteColorHex } from "@/lib/siteColor";
import { fieldClass } from "@/components/ui/field";

type SiteOption = { id: string; name: string };

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

  return (
    <div className="flex items-center gap-2">
      <span
        className="h-6 w-6 shrink-0 rounded-full border border-slate-200"
        style={siteId ? { backgroundColor: siteColorHex(siteId) } : { backgroundColor: "#fff" }}
        title={siteId ? sites.find((s) => s.id === siteId)?.name : "현장 없음"}
      />
      <select
        name={`site_id_${index}`}
        value={siteId}
        onChange={(e) => setSiteId(e.target.value)}
        className={`${fieldClass} w-32 shrink-0`}
      >
        <option value="">현장 없음</option>
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
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
