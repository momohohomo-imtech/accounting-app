import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildMonthGrid, WEEKDAY_LABELS } from "@/lib/calendar";
import { workLogColorCellClass } from "@/lib/workLogColors";
import { siteColorStyle } from "@/lib/siteColor";
import { buildWorkLogSummary, buildSiteAggregate } from "@/lib/workLogSummary";
import { WorkLogMonthFilter } from "@/components/WorkLogMonthFilter";
import { WorkLogExportButtons } from "@/components/WorkLogExportButtons";
import { WorkLogDayEditor } from "@/components/WorkLogDayEditor";
import { WorkLogSummaryTable } from "@/components/WorkLogSummaryTable";
import { SiteAggregateTable } from "@/components/SiteAggregateTable";
import { SiteColorLegend } from "@/components/SiteColorLegend";
import { AutoPrint } from "@/components/AutoPrint";
import { PageTabs } from "@/components/PageTabs";
import { BusinessTripListClient } from "@/components/BusinessTripListClient";
import { cx } from "@/lib/cx";
import type { BusinessTripLog, WorkLog } from "@/lib/types";

const HOLIDAY_TITLE = "휴무";
const TABS = [
  { key: "calendar", label: "작업일지" },
  { key: "trip", label: "출장일지" },
];

export default async function WorkLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; year?: string; month?: string; day?: string; printSummary?: string }>;
}) {
  const { tab, year, month, day, printSummary } = await searchParams;
  const activeTab = tab === "trip" ? "trip" : "calendar";

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <PageTabs basePath="/worklogs" tabs={TABS} active={activeTab} />
      </div>
      {activeTab === "trip" ? (
        <BusinessTripSection />
      ) : (
        <WorkLogCalendarSection year={year} month={month} day={day} printSummary={printSummary} />
      )}
    </div>
  );
}

async function BusinessTripSection() {
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("business_trip_logs")
    .select("*")
    .order("work_date", { ascending: false });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">출장일지</h1>
      <BusinessTripListClient logs={(logs ?? []) as BusinessTripLog[]} />
    </div>
  );
}

async function WorkLogCalendarSection({
  year,
  month,
  day,
  printSummary,
}: {
  year?: string;
  month?: string;
  day?: string;
  printSummary?: string;
}) {
  const isolateSummary = printSummary === "1";
  const now = new Date();
  const selectedYear = year ? Number(year) : now.getFullYear();
  const selectedMonth = month ? Number(month) : now.getMonth() + 1;

  const supabase = await createClient();
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthStart = `${selectedYear}-${pad(selectedMonth)}-01`;
  const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
  const monthEnd = `${selectedYear}-${pad(selectedMonth)}-${pad(lastDay)}`;

  const [{ data: logs }, { data: allDates }, { data: sites }, { data: tripLogs }] = await Promise.all([
    supabase
      .from("work_logs")
      .select("*")
      .gte("log_date", monthStart)
      .lte("log_date", monthEnd)
      .order("log_date", { ascending: true })
      .order("sort_order", { ascending: true }),
    supabase.from("work_logs").select("log_date"),
    supabase.from("sites").select("id, name, color").order("name"),
    supabase.from("business_trip_logs").select("projects"),
  ]);

  const rows = (logs ?? []) as WorkLog[];
  const logsByDate = new Map<string, WorkLog[]>();
  const holidayDates = new Set<string>();
  const unassignedDates = new Set<string>();
  for (const l of rows) {
    const arr = logsByDate.get(l.log_date) ?? [];
    arr.push(l);
    logsByDate.set(l.log_date, arr);
    if ((l.title ?? "").trim() === HOLIDAY_TITLE) holidayDates.add(l.log_date);
    if (l.site_id && !l.project_id) unassignedDates.add(l.log_date);
  }

  const tripDates = new Set(
    (tripLogs ?? []).flatMap((t) => (t.projects as { work_date?: string }[] | null ?? []).map((p) => p.work_date))
  );

  const siteNameById = new Map((sites ?? []).map((s) => [s.id, s.name]));
  const siteColorById = new Map((sites ?? []).map((s) => [s.id, s.color]));
  const monthlySummary = buildWorkLogSummary(rows, sites ?? []);
  const siteAggregate = buildSiteAggregate(rows, sites ?? []);

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
      {isolateSummary && <AutoPrint cleanupHref={basePath} />}

      <div className={isolateSummary ? "space-y-4 print:hidden" : "space-y-4"}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-slate-900">
            작업일지{" "}
            <span className="hidden text-lg font-normal text-slate-500 print:inline">
              {selectedYear}년 {selectedMonth}월
            </span>
          </h1>
          <WorkLogExportButtons
            year={selectedYear}
            month={selectedMonth}
            weeks={weeks}
            logs={rows.map((l) => ({ log_date: l.log_date, title: l.title, color: l.color, site_id: l.site_id }))}
            sites={sites ?? []}
          />
        </div>

        <div className="print:hidden">
          <WorkLogMonthFilter year={selectedYear} month={selectedMonth} />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 print:hidden">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-red-50 ring-1 ring-inset ring-red-200" />
            공휴일
          </span>
          <span className="flex items-center gap-1.5">
            <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-medium text-white">출장일지</span>
            출장일지 있음
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            프로젝트 미선정 작업일지 있음
          </span>
          <span>현장 색상은 아래 &quot;현장별 색상&quot; 참고</span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none print:overflow-visible">
          <div className="min-w-[900px] print:min-w-0 print:w-full">
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
                  const isHoliday = holidayDates.has(cell.dateKey);
                  const hasTrip = tripDates.has(cell.dateKey);
                  const cellClass = cx(
                    "flex min-h-[110px] flex-col gap-0.5 border-b border-r border-slate-200 p-1.5 text-xs last:border-r-0",
                    !cell.inMonth && "bg-slate-50",
                    isHoliday && "bg-red-50"
                  );
                  const dayLabel = (
                    <span className="flex items-center justify-end gap-1">
                      {unassignedDates.has(cell.dateKey) && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" title="프로젝트 미선정 작업일지 있음" />
                      )}
                      <span
                        className={cx(
                          "font-mono text-[11px]",
                          !cell.inMonth
                            ? "text-slate-300"
                            : isHoliday
                              ? "font-bold text-red-600"
                              : cell.weekday === 0
                                ? "text-red-500"
                                : cell.weekday === 6
                                  ? "text-blue-500"
                                  : "text-slate-500"
                        )}
                      >
                        {cell.day}
                      </span>
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
                        {hasTrip && (
                          <span className="truncate rounded bg-indigo-600 px-1 py-0.5 leading-tight font-medium text-white">
                            *출장일지*
                          </span>
                        )}
                        {(logsByDate.get(cell.dateKey) ?? []).map((log) => {
                          const label = log.title?.trim() || (log.site_id ? siteNameById.get(log.site_id) : "") || "";
                          if (!label) return null;
                          return (
                            <span
                              key={log.id}
                              style={log.site_id ? siteColorStyle(log.site_id, siteColorById.get(log.site_id)) : undefined}
                              className={cx(
                                "truncate rounded px-1 py-0.5 leading-tight print:whitespace-normal print:overflow-visible",
                                !log.site_id && workLogColorCellClass(log.color)
                              )}
                            >
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={cx("rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", !isolateSummary && "print:hidden")}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">
            {selectedYear}년 {selectedMonth}월 작업 집계 (현장·내용별 일수)
          </h2>
          <Link
            href={`${basePath}&printSummary=1`}
            className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 print:hidden"
          >
            인쇄
          </Link>
        </div>
        <WorkLogSummaryTable
          rows={monthlySummary}
          emptyMessage="이 달에 현장이 지정된 작업일지가 없습니다."
          year={selectedYear}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
        <h2 className="mb-3 font-semibold text-slate-900">
          현장집계 — 현장별 작업 종류 수·일수 ({selectedYear}년 {selectedMonth}월)
        </h2>
        <SiteAggregateTable
          rows={siteAggregate}
          year={selectedYear}
          emptyMessage="이 달에 현장이 지정된 작업일지가 없습니다."
        />
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

      <SiteColorLegend sites={sites ?? []} />

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
