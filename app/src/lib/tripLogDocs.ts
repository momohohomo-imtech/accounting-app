import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/supabaseFetchAll";
import { one } from "@/lib/relations";
import { resolveWorkLogTitles, type WorkLogTitleRow } from "@/lib/workLogSummary";
import type { TripDayRow, TripProjectDoc } from "@/lib/tripLog";

type TripSiteRel = { name: string; clients: { name: string } | { name: string }[] | null };
type TripProjectRel = { name: string; project_code: string | null; sites: TripSiteRel | TripSiteRel[] | null };
type TripDayWithProject = TripDayRow & { projects: TripProjectRel | TripProjectRel[] | null };

/**
 * 출장일지 문서(프로젝트별 한 장) 불러오기 — 출장일지 탭 목록과 보고서 "출장 현황"이 같이 씀(화면마다 숫자가 달라지지 않게).
 * year 한 해의 출장 날짜 줄을 가져와 [start, end]·현장 이름으로 거르고, 날짜별 작업 내용(작업 집계와 같은 이어받기 — 그 해
 * 1월 1일부터 정함)과 내근 일수용 작업일지 날짜를 붙임. 출장일지 표(090)가 없으면 tableMissing.
 */
export async function loadTripProjectDocs(
  supabase: SupabaseClient,
  opts: { year: number; start: string; end: string; site?: string; periodLabel: string }
): Promise<{ docs: TripProjectDoc[]; siteOptions: string[]; tableMissing: boolean }> {
  const { year, start, end, site, periodLabel } = opts;

  let yearDays: TripDayWithProject[] = [];
  try {
    yearDays = await fetchAllRows<TripDayWithProject>((from, to) =>
      supabase
        .from("trip_log_days")
        .select(
          "id, project_id, work_date, staff_count, helper_count, equipment_used, equipment_place, equipment_hours, note, projects(name, project_code, sites(name, clients(name)))"
        )
        .gte("work_date", `${year}-01-01`)
        .lte("work_date", `${year}-12-31`)
        .order("work_date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
    );
  } catch {
    return { docs: [], siteOptions: [], tableMissing: true };
  }

  const siteOf = (d: TripDayWithProject) => one(one(d.projects)?.sites);
  const siteOptions = Array.from(
    new Set(yearDays.map((d) => siteOf(d)?.name).filter((v): v is string => Boolean(v)))
  ).sort((a, b) => a.localeCompare(b));

  const periodDays = yearDays.filter(
    (d) => d.work_date >= start && d.work_date <= end && (!site || siteOf(d)?.name === site)
  );
  const daysByProject = new Map<string, TripDayWithProject[]>();
  for (const d of periodDays) daysByProject.set(d.project_id, [...(daysByProject.get(d.project_id) ?? []), d]);
  const projectIds = Array.from(daysByProject.keys());
  if (projectIds.length === 0) return { docs: [], siteOptions, tableMissing: false };

  // 머리 정보(작업구분·비고)와 날짜별 작업 내용(작업일지 — 작업 집계와 같은 이어받기, 그 해 1월 1일부터).
  const [{ data: headRows }, workRows] = await Promise.all([
    supabase.from("trip_logs").select("project_id, work_types, note").in("project_id", projectIds),
    fetchAllRows<WorkLogTitleRow & { id: string }>((from, to) =>
      supabase
        .from("work_logs")
        .select("id, log_date, site_id, project_id, title, sort_order, projects(name)")
        .in("project_id", projectIds)
        .gte("log_date", `${year}-01-01`)
        .lte("log_date", end)
        .order("log_date", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
    ),
  ]);
  const headByProject = new Map(
    ((headRows ?? []) as { project_id: string; work_types: string[] | null; note: string | null }[]).map((h) => [h.project_id, h])
  );
  const contentsByKey = new Map<string, string[]>();
  for (const { row, title } of resolveWorkLogTitles(workRows)) {
    if (!title || !row.project_id) continue;
    const key = `${row.project_id}|${row.log_date}`;
    const list = contentsByKey.get(key) ?? [];
    if (!list.includes(title)) list.push(title);
    contentsByKey.set(key, list);
  }
  // 출장 업무 내역서의 내근 일수 — 조회 기간 안에 그 프로젝트가 작업일지에 있는 날짜(이 중 출장 아닌 날을 셈).
  const workDatesByProject = new Map<string, Set<string>>();
  for (const row of workRows) {
    if (!row.project_id || row.log_date < start || row.log_date > end) continue;
    const dates = workDatesByProject.get(row.project_id) ?? new Set<string>();
    dates.add(row.log_date);
    workDatesByProject.set(row.project_id, dates);
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
      workDates: Array.from(workDatesByProject.get(projectId) ?? []).sort(),
      periodLabel,
    };
  });
  return { docs, siteOptions, tableMissing: false };
}
