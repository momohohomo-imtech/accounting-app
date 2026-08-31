"use client";

import { saveDayWorkLogs } from "@/lib/actions/worklogs";
import { WorkLogRowInput, type WorkLogProjectOption } from "@/components/WorkLogRowInput";
import { Button } from "@/components/ui/Button";

type Row = { title: string | null; site_id: string | null; project_id: string | null } | null;
type SiteOption = { id: string; name: string; color: string | null };

export function WorkLogForm({
  dateKey,
  rows,
  sites,
  projects,
  contentSuggestions,
}: {
  dateKey: string;
  rows: Row[];
  sites: SiteOption[];
  projects: WorkLogProjectOption[];
  contentSuggestions: string[];
}) {
  const contentListId = "worklog-content-suggestions";

  return (
    <form
      action={saveDayWorkLogs}
      onSubmit={(e) => {
        if (!confirm("저장하시겠습니까?")) e.preventDefault();
      }}
      className="space-y-2"
    >
      <input type="hidden" name="log_date" value={dateKey} />
      {rows.map((row, i) => (
        <WorkLogRowInput
          key={i}
          index={i}
          defaultTitle={row?.title ?? ""}
          defaultSiteId={row?.site_id ?? ""}
          defaultProjectId={row?.project_id ?? ""}
          sites={sites}
          projects={projects}
          contentListId={contentListId}
        />
      ))}
      <datalist id={contentListId}>
        {contentSuggestions.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit">저장</Button>
      </div>
    </form>
  );
}
