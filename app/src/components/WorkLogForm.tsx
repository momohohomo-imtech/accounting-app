"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveDayWorkLogs } from "@/lib/actions/worklogs";
import { WorkLogRowInput, type WorkLogProjectOption } from "@/components/WorkLogRowInput";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

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
  const router = useRouter();
  const confirm = useConfirm();
  const globalPending = useGlobalPending();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contentListId = "worklog-content-suggestions";
  const logYear = Number(dateKey.slice(0, 4));

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        if (!(await confirm("저장하시겠습니까?"))) return;
        setPending(true);
        setError(null);
        const result = await globalPending.run(() => saveDayWorkLogs(new FormData(form)));
        setPending(false);
        if (result.error || !result.redirectTo) {
          setError(result.error ?? "저장 중 오류가 발생했습니다.");
          return;
        }
        router.push(result.redirectTo, { scroll: false });
      }}
      className="space-y-4"
    >
      <input type="hidden" name="log_date" value={dateKey} />
      {rows.map((row, i) => (
        <WorkLogRowInput
          key={i}
          index={i}
          defaultTitle={row?.title ?? ""}
          defaultSiteId={row?.site_id ?? ""}
          defaultProjectId={row?.project_id ?? ""}
          defaultYear={logYear}
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
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          저장
        </Button>
      </div>
    </form>
  );
}
