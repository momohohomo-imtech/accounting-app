"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveDayWorkLogs } from "@/lib/actions/worklogs";
import {
  WorkLogRowInput,
  type WorkLogProjectOption,
  type WorkLogRowState,
} from "@/components/WorkLogRowInput";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { EMPTY_TRIP_DAY_INPUT, inputToTripDayFields, type TripDayInput } from "@/lib/tripLog";

type Row = { title: string | null; site_id: string | null; project_id: string | null } | null;
type SiteOption = { id: string; name: string; color: string | null };

export function WorkLogForm({
  dateKey,
  rows,
  sites,
  projects,
  contentSuggestions,
  initialTrips = {},
}: {
  dateKey: string;
  rows: Row[];
  sites: SiteOption[];
  projects: WorkLogProjectOption[];
  contentSuggestions: string[];
  /** 이 날짜에 이미 출장으로 저장된 프로젝트별 입력값(trip_log_days). */
  initialTrips?: Record<string, TripDayInput>;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const globalPending = useGlobalPending();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowStates, setRowStates] = useState<WorkLogRowState[]>(() =>
    rows.map((r) => ({ siteId: r?.site_id ?? "", projectId: r?.project_id ?? "", title: r?.title ?? "" }))
  );
  // 출장은 프로젝트 단위(같은 날 같은 프로젝트는 출장일지에 한 줄) — 프로젝트 id별 입력값.
  const [trips, setTrips] = useState<Record<string, TripDayInput>>(initialTrips);
  // 출장 체크를 풀었던 프로젝트의 입력값 — 실수로 풀었다 다시 체크해도 적어 둔 인원·장비가 남게(저장 전까지만).
  const [parkedTrips, setParkedTrips] = useState<Record<string, TripDayInput>>({});
  const contentListId = "worklog-content-suggestions";
  const logYear = Number(dateKey.slice(0, 4));

  // 같은 프로젝트를 고른 첫 줄(출장 인원·장비 칸을 보여줄 줄).
  const ownerRowByProject = new Map<string, number>();
  rowStates.forEach((r, i) => {
    if (r.projectId && !ownerRowByProject.has(r.projectId)) ownerRowByProject.set(r.projectId, i);
  });

  function updateRow(i: number, patch: Partial<WorkLogRowState>) {
    setRowStates((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function toggleTrip(projectId: string, on: boolean) {
    if (on) {
      setTrips((prev) => ({ ...prev, [projectId]: prev[projectId] ?? parkedTrips[projectId] ?? EMPTY_TRIP_DAY_INPUT }));
      return;
    }
    const current = trips[projectId];
    if (current) setParkedTrips((prev) => ({ ...prev, [projectId]: current }));
    setTrips((prev) => {
      const next = { ...prev };
      delete next[projectId];
      return next;
    });
  }
  function updateTrip(projectId: string, patch: Partial<TripDayInput>) {
    setTrips((prev) => ({ ...prev, [projectId]: { ...(prev[projectId] ?? EMPTY_TRIP_DAY_INPUT), ...patch } }));
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!(await confirm("저장하시겠습니까?"))) return;
        const fd = new FormData();
        fd.append("log_date", dateKey);
        rowStates.forEach((r, i) => {
          fd.append(`title_${i}`, r.title);
          fd.append(`site_id_${i}`, r.siteId);
          fd.append(`project_id_${i}`, r.projectId);
        });
        // 지금 줄에 남아 있는 프로젝트만(줄에서 프로젝트를 바꿨으면 예전 프로젝트 출장은 빠짐).
        const tripPayload = Array.from(ownerRowByProject.keys())
          .filter((projectId) => trips[projectId])
          .map((projectId) => ({ project_id: projectId, ...inputToTripDayFields(trips[projectId]) }));
        fd.append("trip_json", JSON.stringify(tripPayload));

        setPending(true);
        setError(null);
        const result = await globalPending.run(() => saveDayWorkLogs(fd));
        setPending(false);
        if (result.error || !result.redirectTo) {
          setError(result.error ?? "저장 중 오류가 발생했습니다.");
          return;
        }
        router.push(result.redirectTo, { scroll: false });
      }}
      className="space-y-4"
    >
      {rowStates.map((row, i) => (
        <WorkLogRowInput
          key={i}
          index={i}
          row={row}
          onChange={(patch) => updateRow(i, patch)}
          defaultYear={logYear}
          sites={sites}
          projects={projects}
          contentListId={contentListId}
          trip={row.projectId ? trips[row.projectId] : undefined}
          tripOwner={ownerRowByProject.get(row.projectId) === i}
          onToggleTrip={(on) => toggleTrip(row.projectId, on)}
          onTripChange={(patch) => updateTrip(row.projectId, patch)}
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
