import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildMonthGrid, WEEKDAY_LABELS } from "@/lib/calendar";
import { workLogColorCellClass } from "@/lib/workLogColors";
import { WorkLogMonthFilter } from "@/components/WorkLogMonthFilter";
import { WorkLogExportButtons } from "@/components/WorkLogExportButtons";
import { WorkLogDayEditor } from "@/components/WorkLogDayEditor";
import { cx } from "@/lib/cx";
import type { WorkLog } from "@/lib/types";

export default async function WorkLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; day?: string }>;
}) {
  const { year, month, day } = await searchParams;
  const now = new Date();
  const selectedYear = year ? Number(year) : now.getFullYear();
  const selectedMonth = month ? Number(month) : now.getMonth() + 1;

  const supabase = await createClient();
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthStart = `${selectedYear}-${pad(selectedMonth)}-01`;
  const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
  const monthEnd = `${selectedYear}-${pad(selectedMonth)}-${pad(lastDay)}`;

  const [{ data: logs }, { data: allDates }] = await Promise.all([
    supabase
      .from("work_logs")
      .select("*")
      .gte("log_date", monthStart)
      .lte("log_date", monthEnd)
      .order("log_date", { ascending: true })
      .order("sort_order", { ascending: true }),
    supabase.from("work_logs").select("log_date"),
  ]);

  const rows = (logs ?? []) as WorkLog[];
  const logsByDate = new Map<string, WorkLog[]>();
  for (const l of rows) {
    const arr = logsByDate.get(l.log_date) ?? [];
    arr.push(l);
    logsByDate.set(l.log_date, arr);
  }

  const monthsByYear = new Map<number, Set<number>>();
  for (const { log_date } of allDates ?? []) {
    const y = Number(log_date.slice(0, 4));
    const m = Number(log_date.slice(5, 7));
    const set = monthsByYear.get(y) ?? new Set<number>();
    set.add(m);
    monthsByYear.set(y, set);
  }
  const savedYears = Array.from(monthsByYear.keys()).sort((a, b) => b - a);

  const weeks = buildMonthGrid(selectedYear, selectedMonth);
  const basePath = `/worklogs?year=${selectedYear}&month=${selectedMonth}`;
  const dayKey = day ? `${selectedYear}-${pad(selectedMonth)}-${pad(Number(day))}` : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">작업일지</h1>
        <WorkLogExportButtons
          year={selectedYear}
          month={selectedMonth}
          weeks={weeks}
          logs={rows.map((l) => ({ log_date: l.log_date, title: l.title, color: l.color }))}
        />
      </div>

      <div className="print:hidden">
        <WorkLogMonthFilter year={selectedYear} month={selectedMonth} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-500">
            {WEEKDAY_LABELS.map((w, i) => (
              <div
                key={w}
                className={cx(
                  "py-2",
                  i === 0 && "text-red-500",
                  i === 6 && "text-blue-500"
                )}
              >
                {w}
              </div>
            ))}
          </div>
          {weeks.map((week) => (
            <div key={week[0].dateKey} className="grid grid-cols-7">
              {week.map((cell) => {
                const cellClass = cx(
                  "flex min-h-[110px] flex-col gap-0.5 border-b border-r border-slate-200 p-1.5 text-xs last:border-r-0",
                  !cell.inMonth && "bg-slate-50"
                );
                const dayLabel = (
                  <span
                    className={cx(
                      "text-right font-mono text-[11px]",
                      !cell.inMonth ? "text-slate-300" : cell.weekday === 0 ? "text-red-500" : cell.weekday === 6 ? "text-blue-500" : "text-slate-500"
                    )}
                  >
                    {cell.day}
                  </span>
                );

                if (!cell.inMonth) {
                  return (
                    <div key={cell.dateKey} className={cellClass}>
                      {dayLabel}
                    </div>
                  );
                }

                return (
                  <Link key={cell.dateKey} href={`${basePath}&day=${cell.day}`} className={cx(cellClass, "hover:bg-slate-50")}>
                    {dayLabel}
                    <div className="flex flex-1 flex-col gap-0.5">
                      {(logsByDate.get(cell.dateKey) ?? []).map((log) => (
                        <span
                          key={log.id}
                          className={cx(
                            "truncate rounded px-1 py-0.5 leading-tight print:whitespace-normal print:overflow-visible",
                            workLogColorCellClass(log.color)
                          )}
                        >
                          {log.title}
                        </span>
                      ))}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {savedYears.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm print:hidden">
          <p className="text-xs font-semibold text-slate-500">저장된 연/월</p>
          <div className="space-y-1.5">
            {savedYears.map((y) => (
              <div key={y} className="flex flex-wrap items-center gap-1.5">
                <span className="w-14 shrink-0 font-mono text-xs text-slate-500">{y}년</span>
                {Array.from(monthsByYear.get(y) ?? []).sort((a, b) => a - b).map((m) => (
                  <Link
                    key={m}
                    href={`/worklogs?year=${y}&month=${m}`}
                    className={cx(
                      "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                      y === selectedYear && m === selectedMonth
                        ? "bg-slate-900 text-white"
                        : "border border-slate-300 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {m}월
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {dayKey && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10 print:hidden">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <WorkLogDayEditor dateKey={dayKey} closeHref={basePath} />
          </div>
        </div>
      )}
    </div>
  );
}
