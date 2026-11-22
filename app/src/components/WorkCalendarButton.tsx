"use client";

import { useMemo, useState } from "react";
import { ModalPortal } from "@/components/ModalPortal";
import { ModalPrintButton } from "@/components/ModalPrintButton";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { buildMonthGrid, WEEKDAY_LABELS } from "@/lib/calendar";
import { cx } from "@/lib/cx";
import {
  calendarPrintTier,
  dayHeadcountLabel,
  monthRangeLabel,
  skippedMonthRanges,
  workCalendarMonths,
  workCalendarTotals,
  workDateRangeLabel,
  type CalendarMonthKey,
  type WorkCalendarDay,
} from "@/lib/workCalendar";

// 프로젝트 보고서 "근무일수" 옆 달력(사용자 요청 11/22): 작업한 달만 보여 주고(빈 달은 뺌), 사내 근무 = 노란 동그라미, 출장 = 빨간
// 동그라미 + 그날 투입 인원("사2 조1"). 날짜·숫자는 근무일수와 같은 기준(lib/workCalendar.ts). "인쇄"는 이 달력만 A4 세로 한 장 —
// 달이 적을수록 크게(lib/workCalendar.ts의 calendarPrintTier). 칸 크기(mm)는 6주짜리 달이 줄마다 와도 한 장에 들어가게 정함
// (위 머리 글 약 36mm + 달 칸 241mm 안) — usePrintFitToPage는 인쇄 직전 "화면" 배치 높이를 재서 이 달력에선 쓸데없이 줄이므로 안 씀.

// 인쇄 크기(단계별) — Tailwind가 찾을 수 있게 통째로 적어 둠
const PRINT_SIZE = {
  // 1달
  1: {
    grid: "print:grid-cols-1 print:gap-[4mm]",
    month: "print:p-[4mm]",
    title: "print:text-[16pt]",
    sub: "print:text-[11pt]",
    week: "print:text-[12pt]",
    cell: "print:h-[22mm]",
    circle: "print:h-[13mm] print:w-[13mm] print:text-[17pt]",
    count: "print:text-[11pt]",
  },
  // 2달(한 줄 1개)
  2: {
    grid: "print:grid-cols-1 print:gap-[4mm]",
    month: "print:p-[3mm]",
    title: "print:text-[14pt]",
    sub: "print:text-[10pt]",
    week: "print:text-[11pt]",
    cell: "print:h-[16mm]",
    circle: "print:h-[10.5mm] print:w-[10.5mm] print:text-[14pt]",
    count: "print:text-[10pt]",
  },
  // 3~4달(한 줄 2개, 2줄)
  3: {
    grid: "print:grid-cols-2 print:gap-[3mm]",
    month: "print:p-[2.5mm]",
    title: "print:text-[12pt]",
    sub: "print:text-[9pt]",
    week: "print:text-[9pt]",
    cell: "print:h-[15mm]",
    circle: "print:h-[9.5mm] print:w-[9.5mm] print:text-[12.5pt]",
    count: "print:text-[8.5pt]",
  },
  // 5~6달(한 줄 2개, 3줄)
  4: {
    grid: "print:grid-cols-2 print:gap-[3mm]",
    month: "print:p-[2mm]",
    title: "print:text-[10.5pt]",
    sub: "print:text-[8pt]",
    week: "print:text-[8pt]",
    cell: "print:h-[10mm]",
    circle: "print:h-[7mm] print:w-[7mm] print:text-[10pt]",
    count: "print:text-[7pt]",
  },
  // 7~9달(한 줄 3개, 3줄)
  5: {
    grid: "print:grid-cols-3 print:gap-[2mm]",
    month: "print:p-[1.5mm]",
    title: "print:text-[9.5pt]",
    sub: "print:text-[6.5pt]",
    week: "print:text-[7pt]",
    cell: "print:h-[10mm]",
    circle: "print:h-[6.5mm] print:w-[6.5mm] print:text-[9pt]",
    count: "print:text-[6pt] print:tracking-tighter",
  },
  // 10~12달(한 줄 3개, 4줄)
  6: {
    grid: "print:grid-cols-3 print:gap-[2mm]",
    month: "print:p-[1.5mm]",
    title: "print:text-[8.5pt]",
    sub: "print:text-[6pt]",
    week: "print:text-[6pt]",
    cell: "print:h-[7.5mm]",
    circle: "print:h-[5mm] print:w-[5mm] print:text-[7pt]",
    count: "print:text-[5pt] print:tracking-tighter",
  },
  // 13달부터(한 줄 4개 — 16달까지 한 장)
  7: {
    grid: "print:grid-cols-4 print:gap-[1.5mm]",
    month: "print:p-[1mm]",
    title: "print:text-[7.5pt]",
    sub: "print:text-[5.5pt]",
    week: "print:text-[5.5pt]",
    cell: "print:h-[7mm]",
    circle: "print:h-[4.5mm] print:w-[4.5mm] print:text-[6pt]",
    count: "print:text-[4.5pt] print:tracking-tighter",
  },
} as const;

type Size = (typeof PRINT_SIZE)[keyof typeof PRINT_SIZE];

// 화면 칸 수 — 휴대폰은 한 줄에 한 달, 넓으면 2~3달
function screenGridClass(monthCount: number) {
  if (monthCount >= 3) return "sm:grid-cols-2 lg:grid-cols-3";
  if (monthCount === 2) return "sm:grid-cols-2";
  return "";
}

function screenWidthClass(monthCount: number) {
  if (monthCount >= 3) return "max-w-5xl";
  if (monthCount === 2) return "max-w-3xl";
  return "max-w-md";
}

const DOT = {
  inhouse: "bg-yellow-300 text-slate-900",
  trip: "bg-red-600 text-white",
} as const;

export function WorkCalendarButton({ title, days }: { title: string; days: WorkCalendarDay[] }) {
  const [open, setOpen] = useState(false);
  if (days.length === 0) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="근무일 달력 — 사내·출장 날짜와 출장 투입 인원"
        className="ml-1.5 inline-flex items-center gap-0.5 whitespace-nowrap rounded border border-slate-300 px-1.5 py-0.5 align-middle text-[11px] font-medium text-slate-600 hover:bg-slate-100 print:hidden"
      >
        <span aria-hidden>📅</span>달력
      </button>
      {open && <WorkCalendarPopup title={title} days={days} onClose={() => setOpen(false)} />}
    </>
  );
}

function WorkCalendarPopup({ title, days, onClose }: { title: string; days: WorkCalendarDay[]; onClose: () => void }) {
  useEscapeKey(true, onClose);
  const months = useMemo(() => workCalendarMonths(days), [days]);
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const totals = workCalendarTotals(days);
  const skipped = skippedMonthRanges(months);
  const size = PRINT_SIZE[calendarPrintTier(months.length)];

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-brand-ink/50 p-4 py-10 print:static print:block print:h-auto print:overflow-visible print:bg-white print:p-0">
        <div
          className={cx(
            "w-full rounded-2xl bg-white p-5 shadow-xl max-md:p-4 print:max-w-none print:rounded-none print:p-0 print:shadow-none",
            screenWidthClass(months.length)
          )}
        >
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-900 print:text-[14pt]">근무 달력</h2>
              <p className="text-sm text-slate-600 print:text-[10pt]">{title}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 print:hidden">
              <ModalPrintButton />
              <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">
                닫기
              </button>
            </div>
          </div>

          <p className="text-sm text-slate-800 print:text-[10pt]">
            <span className="whitespace-nowrap">사내 {totals.inhouse}일</span>
            {" · "}
            <span className="whitespace-nowrap">출장 {totals.trip}일</span>
            {" · "}
            <span className="whitespace-nowrap font-semibold">총 {totals.total}일</span>
            {totals.trip > 0 && (
              <>
                {" · "}
                <span className="whitespace-nowrap">
                  출장 투입 사내 {totals.staff}명 · 조공 {totals.helper}명
                </span>
              </>
            )}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 print:text-[8.5pt]">
            기간 {workDateRangeLabel(days)}
            {skipped.length > 0 && ` · 작업 없는 달은 뺌(${skipped.map((g) => monthRangeLabel(g.from, g.to)).join(", ")})`}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 print:text-[8.5pt]">
            <span className="inline-flex items-center gap-1">
              <span className={cx("inline-block h-3.5 w-3.5 rounded-full", DOT.inhouse)} aria-hidden />
              사내 근무
            </span>
            <span className="inline-flex items-center gap-1">
              <span className={cx("inline-block h-3.5 w-3.5 rounded-full", DOT.trip)} aria-hidden />
              출장
            </span>
            <span>
              출장일 아래 <b className="font-semibold text-red-700">사2 조1</b> = 그날 투입 인원(사내 2명·조공 1명)
            </span>
          </div>

          <div className={cx("mt-3 grid grid-cols-1 gap-3", screenGridClass(months.length), size.grid)}>
            {months.map((m) => (
              <MonthBlock key={`${m.year}-${m.month}`} month={m} byDate={byDate} size={size} />
            ))}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

function MonthBlock({
  month,
  byDate,
  size,
}: {
  month: CalendarMonthKey;
  byDate: Map<string, WorkCalendarDay>;
  size: Size;
}) {
  const weeks = buildMonthGrid(month.year, month.month);
  const cells = weeks.flat();
  const mine = cells.filter((c) => c.inMonth).map((c) => byDate.get(c.dateKey)).filter((d): d is WorkCalendarDay => Boolean(d));
  const tripCount = mine.filter((d) => d.kind === "trip").length;

  return (
    <section className={cx("break-inside-avoid rounded-xl border border-slate-200 p-3 print:rounded-md print:border-slate-400", size.month)}>
      <h3 className={cx("mb-1 flex items-baseline justify-between gap-2 font-semibold text-slate-900", size.title)}>
        <span>
          {month.year}년 {month.month}월
        </span>
        <span className={cx("whitespace-nowrap text-xs font-normal text-slate-500", size.sub)}>
          사내 {mine.length - tripCount} · 출장 {tripCount}
        </span>
      </h3>
      <div className="grid grid-cols-7 text-center">
        {WEEKDAY_LABELS.map((w, i) => (
          <div
            key={w}
            className={cx(
              "py-0.5 text-[11px] font-medium",
              i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-slate-500",
              size.week
            )}
          >
            {w}
          </div>
        ))}
        {cells.map((cell) => {
          if (!cell.inMonth) return <div key={cell.dateKey} className={cx("h-12", size.cell)} />;
          const d = byDate.get(cell.dateKey);
          const count = d?.kind === "trip" ? dayHeadcountLabel(d) : "";
          const label = d
            ? `${month.month}월 ${cell.day}일 ${d.kind === "trip" ? "출장" : "사내 근무"}${
                d.kind === "trip" ? ` — 사내 ${d.staff}명, 조공 ${d.helper}명` : ""
              }`
            : undefined;
          return (
            <div key={cell.dateKey} className={cx("flex h-12 flex-col items-center pt-0.5", size.cell)} title={label}>
              <span
                aria-label={label}
                className={cx(
                  "flex h-7 w-7 items-center justify-center rounded-full text-sm tabular-nums leading-none",
                  d ? cx("font-semibold", DOT[d.kind]) : "text-slate-400",
                  size.circle
                )}
              >
                {cell.day}
              </span>
              {count && (
                <span className={cx("mt-0.5 whitespace-nowrap text-[10px] font-medium leading-none text-red-700", size.count)}>
                  {count}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
