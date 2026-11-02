"use client";

import type { CSSProperties } from "react";
import { cx } from "@/lib/cx";
import {
  chartColumns,
  formatAmount,
  NO_TEAM_COLOR,
  NO_TEAM_LABEL,
  statusLabel,
  teamColor,
  tintHex,
  totalSpan,
  type ScheduledStep,
  type SequenceStart,
  type StepStatus,
  type TeamColorKey,
} from "@/lib/workSequence";

// 공사 작업 순서 흐름 차트(사용자 요청 11/2) — 단계마다 막대 하나, 일 단위는 하루 한 칸(토·일 칸은 옅게), 시간 단위는 한 시간 한 칸.
// 색 = 팀, 모양 = 상태(사용자 결정 11/2 "팀별 색"): 막대 색은 맡은 팀(팀 미정은 남색), 완료는 옅은 막대 + ✓, 계획 끝이 지났는데
// 미완료면 빨간 테두리 + !, 앞 작업과 겹치는 날·시간은 막대 앞쪽 빗금, 빨간 세로선 = 오늘(지금, 막대 뒤로 지나감). 색만으로는 3~4팀
// 넘으면 헷갈려서 막대·왼쪽 칸에 팀 이름도 같이. 앞 작업을 따로 고른 단계는 "N번 뒤", 처음부터 시작하는 단계는 "처음부터"(099 SQL).
// focus(팀별 보기)를 넘기면 그 단계만 진하게 — 나머지는 흐리게, 인쇄에서는 뺌. onOverlapChange를 넘기면 차트에서 바로 겹침을 −/+로
// 고침(순서표 화면), 안 넘기면 보기만. 화면에서는 칸마다 최소 폭을 줘서 칸이 많으면 상자 안에서 옆으로 넘기고(페이지 폭은 안
// 넓힘), 인쇄는 종이 폭에 맞춰 줄임 — 그래서 칸·막대 위치는 px 대신 전체 칸 수에 대한 %로.
type ChartStep = {
  content: string;
  done: boolean;
  /** 맡은 팀(없으면 팀 미정 — 남색) */
  team?: { name: string; color: TeamColorKey } | null;
};

const LABEL_WIDTH = 184;
const LATE_RED = "#d03b3b";
/** 앞 작업과 겹치는 부분 빗금 — 진한 막대엔 흰 줄, 옅은(완료) 막대엔 회색 줄 */
const hatch = (light: boolean) =>
  `repeating-linear-gradient(45deg, ${light ? "rgba(15,23,42,0.22)" : "rgba(255,255,255,0.55)"} 0 3px, transparent 3px 7px)`;

export function WorkSequenceChart({
  steps,
  schedule,
  seq,
  statuses,
  todayAt = null,
  focus = null,
  teamConflictSteps,
  legendTeams,
  onOverlapChange,
}: {
  steps: ChartStep[];
  schedule: ScheduledStep[];
  seq: SequenceStart;
  /** 단계별 진행 상태(지남이면 빨간 테두리) */
  statuses?: StepStatus[];
  /** 오늘(지금) 위치 — 순서표 시작부터 몇 칸째(lib/workSequence.ts todayOffset), 차트 밖이면 null */
  todayAt?: number | null;
  /** 팀별 보기 — true인 단계만 진하게(나머지는 흐리게, 인쇄에서는 뺌). null = 전체 */
  focus?: boolean[] | null;
  /** 같은 팀 다른 단계와 일정이 겹치는 단계(위치) */
  teamConflictSteps?: Set<number>;
  /** 범례에 보일 팀(이 순서표에서 쓴 팀) — 비어 있으면 팀 범례 없이 */
  legendTeams?: { name: string; color: TeamColorKey | null }[];
  onOverlapChange?: (index: number, value: number) => void;
}) {
  if (steps.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">단계를 추가하면 흐름 차트가 그려집니다.</p>;
  }
  const columns = chartColumns(totalSpan(schedule), seq);
  const count = columns.length;
  const pct = (n: number) => `${(n / count) * 100}%`;
  const minTrack = count * (seq.unit === "day" ? 40 : 30);
  const stepSize = seq.unit === "day" ? 1 : 0.5;
  const unitWord = seq.unit === "day" ? "날" : "시간";
  // 화면 최소 폭(칸 수 × 칸 폭) — 인쇄에서는 풀어서 종이 폭에 맞춤
  const trackStyle = { "--track-min": `${minTrack}px` } as CSSProperties;
  // 오늘 선은 막대 뒤로(z-0 < 막대 z-[1]) — 막대 글자를 가리지 않게
  const todayLine =
    todayAt === null ? null : (
      <div className="pointer-events-none absolute inset-y-0 z-0 w-0.5 -translate-x-1/2 bg-red-500/80" style={{ left: pct(todayAt) }} aria-hidden />
    );
  const teamsInLegend = legendTeams ?? [];

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-slate-200 print:overflow-visible">
        <div className="w-max min-w-full text-xs print:w-full">
          {/* 머리 줄: 날짜(요일) 또는 시각 */}
          <div className="flex border-b border-slate-200 bg-slate-50">
            <div className="shrink-0 border-r border-slate-200 px-2 py-1.5 font-medium text-slate-500" style={{ width: LABEL_WIDTH }}>
              작업
            </div>
            <div className="relative flex min-w-[var(--track-min)] flex-1 print:min-w-0" style={trackStyle}>
              {columns.map((c, i) => (
                <div
                  key={i}
                  className={cx(
                    "overflow-hidden border-r border-slate-100 py-1 text-center leading-tight tabular-nums text-slate-500",
                    c.weekend && "bg-rose-50 text-rose-500"
                  )}
                  style={{ width: pct(1) }}
                >
                  <div className="text-[10px]">{c.sub || " "}</div>
                  <div>{c.label}</div>
                </div>
              ))}
              {todayAt !== null && (
                <span
                  className="absolute -top-px z-[2] -translate-x-1/2 rounded-b bg-red-500 px-1 text-[10px] font-semibold leading-4 text-white"
                  style={{ left: pct(todayAt) }}
                >
                  {seq.unit === "day" ? "오늘" : "지금"}
                </span>
              )}
            </div>
          </div>
          {steps.map((step, i) => {
            const s = schedule[i];
            const duration = s.end - s.start;
            const status = statuses?.[i];
            const overdue = status?.state === "overdue";
            const late = overdue || status?.state === "doneLate";
            const label = status ? statusLabel(status) : "";
            const pred = s.predecessor;
            const fromStart = i > 0 && pred === null;
            const predLabel = pred === null || pred === i - 1 ? "앞과 겹침" : `${pred + 1}번 뒤 · 겹침`;
            const team = step.team ?? null;
            const color = team ? teamColor(team.color) : NO_TEAM_COLOR;
            const dimmed = focus ? !focus[i] : false;
            const conflict = teamConflictSteps?.has(i) ?? false;
            const barStyle: CSSProperties = step.done
              ? { background: tintHex(color.hex, 0.22), border: `1.5px solid ${color.hex}`, color: "#1e293b" }
              : { background: color.hex, color: color.ink };
            if (overdue) barStyle.boxShadow = `0 0 0 2px #fff, 0 0 0 4px ${LATE_RED}`;
            const barText = `${step.done ? "✓ " : overdue ? "! " : ""}${team ? `${team.name} · ` : ""}${formatAmount(duration, seq.unit)}`;
            return (
              <div
                key={i}
                className={cx(
                  "flex border-b border-slate-100 last:border-0 print:break-inside-avoid",
                  dimmed && "opacity-25 print:hidden"
                )}
              >
                <div className="shrink-0 space-y-0.5 border-r border-slate-200 px-2 py-1.5" style={{ width: LABEL_WIDTH }}>
                  <p className={cx("truncate font-medium", overdue ? "text-red-700" : "text-slate-800")} title={step.content}>
                    {i + 1}. {step.content || "(작업 내용 없음)"}
                  </p>
                  {(team || label || step.done || conflict) && (
                    <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] leading-4 text-slate-500">
                      {team && (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color.hex }} aria-hidden />
                          <span className="truncate">{team.name}</span>
                        </span>
                      )}
                      {step.done && status?.state !== "doneLate" && <span className="text-slate-600">✓ 완료</span>}
                      {label && (
                        <span className={cx("font-semibold", late ? "text-red-600" : "text-sky-700")}>
                          {overdue ? "! " : ""}
                          {label}
                        </span>
                      )}
                      {conflict && <span className="font-semibold text-amber-700">팀 일정 겹침</span>}
                    </p>
                  )}
                  {fromStart && <p className="text-[11px] text-slate-500">처음부터 시작</p>}
                  {i > 0 && !fromStart && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      <span className="whitespace-nowrap">{predLabel}</span>
                      {onOverlapChange && (
                        <button
                          type="button"
                          aria-label={`${i + 1}번 겹침 줄이기`}
                          disabled={s.overlap <= 0}
                          onClick={() => onOverlapChange(i, Math.max(0, s.overlap - stepSize))}
                          className="h-5 w-5 rounded border border-slate-300 leading-none hover:bg-slate-100 disabled:opacity-40 print:hidden"
                        >
                          −
                        </button>
                      )}
                      <span className="min-w-[2.5rem] text-center font-medium text-slate-700 tabular-nums">
                        {formatAmount(s.overlap, seq.unit)}
                      </span>
                      {onOverlapChange && pred !== null && (
                        <button
                          type="button"
                          aria-label={`${i + 1}번 겹침 늘리기`}
                          disabled={s.overlap >= schedule[pred].end - schedule[pred].start}
                          onClick={() => onOverlapChange(i, s.overlap + stepSize)}
                          className="h-5 w-5 rounded border border-slate-300 leading-none hover:bg-slate-100 disabled:opacity-40 print:hidden"
                        >
                          +
                        </button>
                      )}
                    </div>
                  )}
                  {s.overlapClamped && (
                    <p className="text-[11px] text-red-600">앞 작업 기간보다 길어서 {formatAmount(s.overlap, seq.unit)}로 계산</p>
                  )}
                  {s.afterInvalid && <p className="text-[11px] text-red-600">고른 앞 작업이 뒤 순번이라 바로 앞 단계 기준</p>}
                </div>
                {/* 막대 자리 — relative: 막대(absolute)가 이 줄 안에만 그려지게 */}
                <div className="relative min-h-10 min-w-[var(--track-min)] flex-1 print:min-w-0" style={trackStyle}>
                  {columns.map((c, ci) => (
                    <div
                      key={ci}
                      className={cx("absolute inset-y-0 border-r border-slate-100", c.weekend && "bg-rose-50/60")}
                      style={{ left: pct(ci), width: pct(1) }}
                    />
                  ))}
                  {todayLine}
                  <div
                    className="absolute top-1/2 z-[1] flex h-6 -translate-y-1/2 items-center overflow-hidden rounded text-[11px] font-semibold"
                    style={{ ...barStyle, left: pct(s.start), width: pct(duration) }}
                    title={`${i + 1}. ${step.content}${team ? ` — ${team.name}` : ""} — ${formatAmount(duration, seq.unit)}${
                      s.overlap ? `, 앞 작업과 겹침 ${formatAmount(s.overlap, seq.unit)}` : ""
                    }${label ? ` — ${label}` : ""}`}
                  >
                    {s.overlap > 0 && duration > 0 && (
                      <span
                        className="h-full shrink-0"
                        style={{ width: `${(s.overlap / duration) * 100}%`, backgroundImage: hatch(step.done) }}
                        aria-hidden
                      />
                    )}
                    <span className="truncate px-1.5">{barText}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        {teamsInLegend.length > 0 ? (
          teamsInLegend.map((t, i) => (
            <span key={`${t.name}-${i}`} className="inline-flex items-center gap-1">
              <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: teamColor(t.color).hex }} /> {t.name}
            </span>
          ))
        ) : (
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: NO_TEAM_COLOR.hex }} /> 작업
          </span>
        )}
        {teamsInLegend.length > 0 && <span className="text-slate-300">|</span>}
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: "#64748b", backgroundImage: hatch(false) }} /> 빗금 = 앞
          작업과 겹치는 {unitWord}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: tintHex("#64748b", 0.22), border: "1.5px solid #64748b" }} /> ✓
          옅은 막대 = 완료
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-4 rounded-sm bg-slate-500" style={{ boxShadow: `0 0 0 1.5px #fff, 0 0 0 3px ${LATE_RED}` }} /> !
          빨간 테두리 = 계획보다 늦음
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-0.5 bg-red-500" /> {seq.unit === "day" ? "오늘" : "지금"}
        </span>
        {seq.unit === "day" && (
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-4 rounded-sm bg-rose-50 ring-1 ring-rose-200" /> 토·일(작업일에 포함)
          </span>
        )}
      </p>
    </div>
  );
}

/** 범례용 — 쓴 팀(순서표 팀 목록 순서) + 팀 미정 단계가 있으면 "팀 미정" */
export function chartLegendTeams(
  teams: { id: string; name: string; color: TeamColorKey }[],
  stepTeamIds: (string | null)[]
): { name: string; color: TeamColorKey | null }[] {
  const used = new Set(stepTeamIds);
  const list: { name: string; color: TeamColorKey | null }[] = teams.filter((t) => used.has(t.id)).map((t) => ({ name: t.name, color: t.color }));
  if (list.length > 0 && stepTeamIds.some((id) => !id)) list.push({ name: NO_TEAM_LABEL, color: null });
  return list;
}
