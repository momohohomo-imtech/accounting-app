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
import { BusinessTripFilter } from "@/components/BusinessTripFilter";
import { TripLogList } from "@/components/TripLogList";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { monthRange } from "@/lib/dateRange";
import { cx } from "@/lib/cx";
import { one } from "@/lib/relations";
import type { BusinessTripLog, WorkLog } from "@/lib/types";
import { fetchAllRows } from "@/lib/supabaseFetchAll";
import { nowKst } from "@/lib/kstDate";
import { resolveWorkLogTitles, type WorkLogTitleRow } from "@/lib/workLogSummary";
import type { TripDayRow, TripProjectDoc } from "@/lib/tripLog";

const HOLIDAY_TITLE = "휴무";
const TABS = [
  { key: "calendar", label: "작업일지" },
  { key: "trip", label: "출장일지" },
];
const TRIP_FLOOR_YEAR = 2026;

export default async function WorkLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    year?: string;
    month?: string;
    day?: string;
    printSummary?: string;
    site?: string;
    project?: string;
    open?: string;
  }>;
}) {
  const { tab, year, month, day, printSummary, site, open } = await searchParams;
  const activeTab = tab === "trip" ? "trip" : "calendar";

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <PageTabs basePath="/worklogs" tabs={TABS} active={activeTab} />
      </div>
      {activeTab === "trip" ? (
        <BusinessTripSection year={year} month={month} site={site} open={open} />
      ) : (
        <WorkLogCalendarSection year={year} month={month} day={day} printSummary={printSummary} />
      )}
    </div>
  );
}

type TripSiteRel = { name: string; clients: { name: string } | { name: string }[] | null };
type TripProjectRel = { name: string; project_code: string | null; sites: TripSiteRel | TripSiteRel[] | null };
type TripDayWithProject = TripDayRow & { projects: TripProjectRel | TripProjectRel[] | null };

// 출장일지(새 방식, 090) — 작업일지 팝업에서 "출장"을 체크한 날짜를 프로젝트별 한 장으로. 예전 방식 출장일지는 아래에 보기만.
async function BusinessTripSection({
  year,
  month,
  site,
  open,
}: {
  year?: string;
  month?: string;
  site?: string;
  open?: string;
}) {
  const supabase = await createClient();
  const { year: currentYear, month: currentMonth } = nowKst();
  const selectedYear = year ? Number(year) : currentYear;
  const selectedMonth = month ?? "all";
  const { start, end } = monthRange(selectedYear, selectedMonth, currentMonth);

  let yearDays: TripDayWithProject[] = [];
  let tripTableMissing = false;
  try {
    yearDays = await fetchAllRows<TripDayWithProject>((from, to) =>
      supabase
        .from("trip_log_days")
        .select(
          "id, project_id, work_date, staff_count, helper_count, equipment_used, equipment_place, equipment_hours, note, projects(name, project_code, sites(name, clients(name)))"
        )
        .gte("work_date", `${selectedYear}-01-01`)
        .lte("work_date", `${selectedYear}-12-31`)
        .order("work_date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
    );
  } catch {
    tripTableMissing = true;
  }

  const [legacyLogs, legacyDates] = await Promise.all([
    fetchAllRows<BusinessTripLog>((from, to) =>
      supabase
        .from("business_trip_logs")
        .select("*")
        .gte("work_date", start)
        .lte("work_date", end)
        .order("work_date", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<{ work_date: string }>((from, to) =>
      supabase.from("business_trip_logs").select("work_date").order("work_date", { ascending: true }).order("id", { ascending: true }).range(from, to)
    ),
  ]);

  const siteOf = (d: TripDayWithProject) => one(one(d.projects)?.sites);
  const periodDays = yearDays.filter(
    (d) => d.work_date >= start && d.work_date <= end && (!site || siteOf(d)?.name === site)
  );
  const daysByProject = new Map<string, TripDayWithProject[]>();
  for (const d of periodDays) daysByProject.set(d.project_id, [...(daysByProject.get(d.project_id) ?? []), d]);
  const projectIds = Array.from(daysByProject.keys());

  // 머리 정보(작업구분·비고)와 날짜별 작업 내용(작업일지 — 작업 집계와 같은 이어받기, 그 해 1월 1일부터).
  const [{ data: headRows }, workRows] = await Promise.all([
    projectIds.length
      ? supabase.from("trip_logs").select("project_id, work_types, note").in("project_id", projectIds)
      : Promise.resolve({ data: [] as { project_id: string; work_types: string[]; note: string | null }[] }),
    projectIds.length
      ? fetchAllRows<WorkLogTitleRow & { id: string }>((from, to) =>
          supabase
            .from("work_logs")
            .select("id, log_date, site_id, project_id, title, sort_order, projects(name)")
            .in("project_id", projectIds)
            .gte("log_date", `${selectedYear}-01-01`)
            .lte("log_date", end)
            .order("log_date", { ascending: true })
            .order("sort_order", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to)
        )
      : Promise.resolve([] as (WorkLogTitleRow & { id: string })[]),
  ]);
  const headByProject = new Map((headRows ?? []).map((h) => [h.project_id, h]));
  const contentsByKey = new Map<string, string[]>();
  for (const { row, title } of resolveWorkLogTitles(workRows)) {
    if (!title || !row.project_id) continue;
    const key = `${row.project_id}|${row.log_date}`;
    const list = contentsByKey.get(key) ?? [];
    if (!list.includes(title)) list.push(title);
    contentsByKey.set(key, list);
  }

  const docs: TripProjectDoc[] = projectIds.map((projectId) => {
    const days = daysByProject.get(projectId) ?? [];
    const project = one(days[0]?.projects);
    const siteRel = one(project?.sites);
    const head = headByProject.get(projectId);
    return {
      projectId,
      projectName: project?.name ?? "(프로젝트 정보 없음)",
      projectCode: project?.project_code ?? null,
      siteName: siteRel?.name ?? null,
      clientName: one(siteRel?.clients)?.name ?? null,
      workTypes: head?.work_types ?? [],
      note: head?.note ?? "",
      days: days.map((d) => ({
        id: d.id,
        project_id: d.project_id,
        work_date: d.work_date,
        staff_count: d.staff_count,
        helper_count: d.helper_count,
        equipment_used: d.equipment_used,
        equipment_place: d.equipment_place,
        equipment_hours: d.equipment_hours,
        note: d.note,
        contents: (contentsByKey.get(`${projectId}|${d.work_date}`) ?? []).join(" / "),
      })),
    };
  });

  const firstYear = Math.min(
    ...legacyDates.map((l) => Number(l.work_date.slice(0, 4))).filter((y) => !Number.isNaN(y)),
    TRIP_FLOOR_YEAR
  );
  const years = Array.from({ length: currentYear - firstYear + 1 }, (_, i) => currentYear - i);
  if (!years.includes(selectedYear)) years.unshift(selectedYear);
  years.sort((a, b) => b - a);

  const siteOptions = Array.from(
    new Set(yearDays.map((d) => siteOf(d)?.name).filter((v): v is string => Boolean(v)))
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">출장일지</h1>
        <BusinessTripFilter
          years={years}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          siteOptions={siteOptions}
          selectedSite={site ?? ""}
          projectOptions={[]}
          selectedProject=""
        />
      </div>
      {tripTableMissing ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          새 출장일지 표가 아직 없습니다 — Supabase SQL Editor에서 <code>090_trip_log_days.sql</code>을 실행하면, 작업일지
          팝업에서 &lsquo;출장&rsquo;을 체크한 날짜가 프로젝트별로 여기에 모입니다.
        </p>
      ) : (
        <TripLogList docs={docs} openProjectId={open} />
      )}
      {legacyLogs.length > 0 && (
        <CollapsibleSection title={`이전 출장일지 (예전 방식 · 보기만) ${legacyLogs.length}건`}>
          <p className="mb-3 text-xs text-slate-500">
            예전 방식으로 쓴 출장일지 — 새로 쓰거나 고칠 수는 없고 보기·인쇄·엑셀·삭제만 됩니다. 새 출장일지는 작업일지
            팝업의 &lsquo;출장&rsquo; 체크로 만듭니다.
          </p>
          <BusinessTripListClient logs={legacyLogs} />
        </CollapsibleSection>
      )}
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
  const now = nowKst();
  const selectedYear = year ? Number(year) : now.year;
  const selectedMonth = month ? Number(month) : now.month;

  const supabase = await createClient();
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthStart = `${selectedYear}-${pad(selectedMonth)}-01`;
  const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
  const monthEnd = `${selectedYear}-${pad(selectedMonth)}-${pad(lastDay)}`;

  // 작업 집계는 내용이 빈 줄이 앞 줄 내용을 이어받아서, 그 해 1월 1일부터 가져와 정한 뒤 이 달 줄만 셈
  // (lib/workLogSummary.ts resolveWorkLogTitles). 달력 등 나머지는 이 달 줄만 씀.
  const [yearToMonthLogs, allDates, { data: sites }, tripLogs] = await Promise.all([
    fetchAllRows<WorkLog>((from, to) =>
      supabase
        .from("work_logs")
        .select("*, projects(name)")
        .gte("log_date", `${selectedYear}-01-01`)
        .lte("log_date", monthEnd)
        .order("log_date", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<{ log_date: string }>((from, to) =>
      supabase.from("work_logs").select("log_date").order("log_date", { ascending: true }).range(from, to)
    ),
    supabase.from("sites").select("id, name, color").order("name"),
    // 새 출장일지(090)에서 출장으로 체크된 날짜 — 표가 없으면(090 실행 전) 비어 있음.
    supabase.from("trip_log_days").select("work_date").gte("work_date", monthStart).lte("work_date", monthEnd),
  ]);

  const rows = yearToMonthLogs.filter((l) => l.log_date >= monthStart);
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

  const tripDates = new Set((tripLogs.data ?? []).map((t) => t.work_date as string));

  const siteNameById = new Map((sites ?? []).map((s) => [s.id, s.name]));
  const siteColorById = new Map((sites ?? []).map((s) => [s.id, s.color]));
  const monthRange = { from: monthStart, to: monthEnd };
  const monthlySummary = buildWorkLogSummary(yearToMonthLogs, sites ?? [], monthRange);
  const siteAggregate = buildSiteAggregate(yearToMonthLogs, sites ?? [], monthRange);

  const monthsByYear = new Map<number, Set<number>>();
  for (const { log_date } of allDates) {
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
                          "tabular-nums text-[11px]",
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
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-sm print:hidden">
          <p className="text-xs font-semibold text-slate-500">저장된 연/월</p>
          <div className="space-y-1.5">
            {savedYears.map((y) => (
              <div key={y} className="flex flex-wrap items-center gap-1.5">
                <span className="w-14 shrink-0 tabular-nums text-xs text-slate-500">{y}년</span>
                {Array.from(monthsByYear.get(y) ?? []).sort((a, b) => a - b).map((m) => (
                  <Link
                    key={m}
                    href={`/worklogs?year=${y}&month=${m}`}
                    className={cx(
                      "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                      y === selectedYear && m === selectedMonth
                        ? "bg-brand-navy text-white"
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
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-ink/50 p-4 py-10 print:hidden">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <WorkLogDayEditor dateKey={dayKey} closeHref={basePath} />
          </div>
        </div>
      )}
    </div>
  );
}
