"use client";

import { useMemo } from "react";
import { resolveSiteColor } from "@/lib/siteColor";
import { fieldClass, inlineFieldClass } from "@/components/ui/field";
import { WorkLogProjectPicker } from "@/components/WorkLogProjectPicker";
import type { TripDayInput } from "@/lib/tripLog";

type SiteOption = { id: string; name: string; color: string | null };
export type WorkLogProjectOption = {
  id: string;
  name: string;
  site_id: string;
  year: number;
  project_code: string | null;
  status: string;
};
export type WorkLogRowState = { siteId: string; projectId: string; title: string };

export function WorkLogRowInput({
  index,
  row,
  onChange,
  defaultYear,
  sites,
  projects,
  contentListId,
  trip,
  tripOwner,
  onToggleTrip,
  onTripChange,
}: {
  index: number;
  row: WorkLogRowState;
  onChange: (patch: Partial<WorkLogRowState>) => void;
  defaultYear: number;
  sites: SiteOption[];
  projects: WorkLogProjectOption[];
  contentListId: string;
  /** 이 줄 프로젝트의 출장 입력값 — 없으면 출장 체크 안 함. */
  trip: TripDayInput | undefined;
  /** 같은 프로젝트를 고른 첫 줄 — 출장 인원·장비 칸은 이 줄에만(같은 날 같은 프로젝트는 출장일지에 한 줄). */
  tripOwner: boolean;
  onToggleTrip: (on: boolean) => void;
  onTripChange: (patch: Partial<TripDayInput>) => void;
}) {
  const selectedSite = sites.find((s) => s.id === row.siteId);
  const projectsForSite = useMemo(() => projects.filter((p) => p.site_id === row.siteId), [projects, row.siteId]);
  const tripId = `worklog-trip-${index}`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="h-6 w-6 shrink-0 rounded-full border border-slate-200"
          style={row.siteId ? { backgroundColor: resolveSiteColor(row.siteId, selectedSite?.color) } : { backgroundColor: "#fff" }}
          title={selectedSite?.name ?? "현장 없음"}
        />
        <div className="w-32 shrink-0">
          <select
            aria-label={`${index + 1}번째 줄 현장`}
            value={row.siteId}
            onChange={(e) => onChange({ siteId: e.target.value, projectId: "" })}
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
        <div className="w-40 shrink-0">
          {row.siteId ? (
            <WorkLogProjectPicker
              projects={projectsForSite}
              value={row.projectId}
              onChange={(id) => onChange({ projectId: id })}
              defaultYear={defaultYear}
            />
          ) : (
            <span className={`${fieldClass} block truncate text-slate-400`}>현장 먼저 선택</span>
          )}
        </div>
        <label
          htmlFor={tripId}
          className={`flex shrink-0 items-center gap-1 text-sm font-medium ${row.projectId ? "text-indigo-700" : "text-slate-300"}`}
          title={row.projectId ? "체크하면 이 날짜가 이 프로젝트의 출장일지에 들어갑니다" : "프로젝트를 고르면 출장으로 체크할 수 있습니다"}
        >
          <input
            id={tripId}
            type="checkbox"
            checked={Boolean(trip)}
            disabled={!row.projectId}
            onChange={(e) => onToggleTrip(e.target.checked)}
            className="h-4 w-4"
          />
          출장
        </label>
      </div>
      <input
        aria-label={`${index + 1}번째 줄 내용`}
        value={row.title}
        onChange={(e) => onChange({ title: e.target.value })}
        placeholder={`${index + 1}번째 내용 (예: 파이프공사, 휴무)`}
        list={contentListId}
        className={`${fieldClass} w-full py-3 text-lg`}
      />
      {trip && tripOwner && (
        <div className="space-y-1.5 rounded-lg border border-indigo-200 bg-indigo-50 p-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-slate-700">
            <span className="text-xs font-semibold text-indigo-700">출장</span>
            <label className="flex items-center gap-1">
              사내
              <input
                type="number"
                min={0}
                inputMode="numeric"
                aria-label={`${index + 1}번째 줄 출장 사내 인원`}
                value={trip.staff}
                onChange={(e) => onTripChange({ staff: e.target.value })}
                className={`${inlineFieldClass} w-16 py-1 text-right`}
              />
              명
            </label>
            <label className="flex items-center gap-1">
              조공
              <input
                type="number"
                min={0}
                inputMode="numeric"
                aria-label={`${index + 1}번째 줄 출장 조공 인원`}
                value={trip.helper}
                onChange={(e) => onTripChange({ helper: e.target.value })}
                className={`${inlineFieldClass} w-16 py-1 text-right`}
              />
              명
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={trip.equipmentUsed}
                onChange={(e) => onTripChange({ equipmentUsed: e.target.checked })}
                className="h-4 w-4"
              />
              장비 투입
            </label>
          </div>
          {trip.equipmentUsed && (
            <div className="grid grid-cols-[1fr_7rem] gap-1.5">
              <input
                aria-label={`${index + 1}번째 줄 장비 사용처`}
                value={trip.place}
                onChange={(e) => onTripChange({ place: e.target.value })}
                placeholder="장비 사용처"
                className={`${fieldClass} py-1`}
              />
              <input
                aria-label={`${index + 1}번째 줄 장비 시간`}
                value={trip.hours}
                onChange={(e) => onTripChange({ hours: e.target.value })}
                placeholder="시간"
                className={`${fieldClass} py-1`}
              />
            </div>
          )}
          <input
            aria-label={`${index + 1}번째 줄 출장 비고`}
            value={trip.note}
            onChange={(e) => onTripChange({ note: e.target.value })}
            placeholder="비고 (작업자 이름 등)"
            className={`${fieldClass} py-1`}
          />
        </div>
      )}
      {trip && !tripOwner && (
        <p className="text-xs text-indigo-600">윗줄과 같은 프로젝트 — 출장일지에는 윗줄의 인원·장비로 한 줄만 들어갑니다.</p>
      )}
    </div>
  );
}
