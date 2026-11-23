"use client";

import { useState } from "react";
import { cx } from "@/lib/cx";
import { buildMonthGrid, WEEKDAY_LABELS } from "@/lib/calendar";
import { MAX_MULTI_DATES, toggleDate } from "@/lib/multiDate";
import { todayString } from "@/lib/format";

// 매입매출 등록 "여러 날짜에 같은 내용으로"(11/23) — 달력에서 날짜를 눌러 여러 개 고름(다시 누르면 뺌), 달을 넘겨 가며 고를 수 있음.
// 고른 날짜는 아래에 날짜 순으로(×로 빼기). 계산은 lib/multiDate.ts.
export function MultiDatePicker({ dates, onChange }: { dates: string[]; onChange: (dates: string[]) => void }) {
  const start = dates[0] ?? todayString();
  const [ym, setYm] = useState({ year: Number(start.slice(0, 4)), month: Number(start.slice(5, 7)) });
  const today = todayString();
  const selected = new Set(dates);
  const full = dates.length >= MAX_MULTI_DATES;
  const move = (delta: number) =>
    setYm(({ year, month }) => {
      const i = year * 12 + (month - 1) + delta;
      return { year: Math.floor(i / 12), month: (i % 12) + 1 };
    });

  return (
    // PC에서는 달력이 너무 넓지 않게(칸이 커지기만 함) 폭을 줄임, 휴대폰은 화면 폭 그대로
    <div className="max-w-md rounded-xl border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button type="button" onClick={() => move(-1)} className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100" aria-label="이전 달">
          ◀
        </button>
        <span className="text-sm font-semibold text-slate-900">
          {ym.year}년 {ym.month}월
        </span>
        <button type="button" onClick={() => move(1)} className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100" aria-label="다음 달">
          ▶
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_LABELS.map((w, i) => (
          <span key={w} className={cx("text-[11px] font-medium", i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-slate-500")}>
            {w}
          </span>
        ))}
        {buildMonthGrid(ym.year, ym.month)
          .flat()
          .map((cell) =>
            cell.inMonth ? (
              <button
                key={cell.dateKey}
                type="button"
                aria-pressed={selected.has(cell.dateKey)}
                disabled={!selected.has(cell.dateKey) && full}
                onClick={() => onChange(toggleDate(dates, cell.dateKey))}
                className={cx(
                  "h-9 rounded-lg text-sm tabular-nums transition-colors disabled:opacity-40",
                  selected.has(cell.dateKey)
                    ? "bg-brand font-semibold text-white"
                    : "text-slate-700 hover:bg-slate-100",
                  cell.dateKey === today && !selected.has(cell.dateKey) && "ring-1 ring-slate-400"
                )}
              >
                {cell.day}
              </button>
            ) : (
              <span key={cell.dateKey} />
            )
          )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-500">
          고른 날짜 <b className="text-slate-900">{dates.length}</b>일{full && ` (한 번에 ${MAX_MULTI_DATES}일까지)`}
        </span>
        {dates.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onChange(toggleDate(dates, d))}
            className="inline-flex items-center gap-0.5 rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand-navy hover:bg-red-50 hover:text-red-600"
            title="눌러서 빼기"
          >
            {Number(d.slice(5, 7))}/{Number(d.slice(8, 10))}
            <span aria-hidden>×</span>
          </button>
        ))}
        {dates.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="text-xs text-slate-400 underline hover:text-slate-600">
            모두 빼기
          </button>
        )}
      </div>
    </div>
  );
}
