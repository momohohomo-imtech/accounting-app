"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabaseFetchAll";
import { resolveWorkLogTitles, SPECIAL_TITLES, type WorkLogTitleRow } from "@/lib/workLogSummary";
import { inputToTripDayFields } from "@/lib/tripLog";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type SiteLogRow = WorkLogTitleRow & { id: string; content: string | null };

// 한 현장의 start~end 작업일지 줄 — 내용 이어받기(resolveWorkLogTitles)에 필요한 칸 + 프로젝트 이름.
function fetchSiteLogs(supabase: Supabase, siteId: string, start: string, end: string) {
  return fetchAllRows<SiteLogRow>((from, to) =>
    supabase
      .from("work_logs")
      .select("id, log_date, site_id, project_id, title, sort_order, content, projects(name)")
      .eq("site_id", siteId)
      .gte("log_date", start)
      .lte("log_date", end)
      .order("log_date", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to)
  );
}

// 작업일지 팝업의 "출장" 체크(프로젝트별 한 줄) — 클라이언트 값은 믿지 않고 여기서 다시 다듬음.
function parseTrips(formData: FormData) {
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("trip_json") ?? "[]"));
  } catch {
    raw = [];
  }
  const seen = new Set<string>();
  const trips: (ReturnType<typeof inputToTripDayFields> & { project_id: string })[] = [];
  for (const t of Array.isArray(raw) ? (raw as Record<string, unknown>[]) : []) {
    const projectId = typeof t?.project_id === "string" ? t.project_id : "";
    if (!projectId || seen.has(projectId)) continue;
    seen.add(projectId);
    trips.push({
      project_id: projectId,
      ...inputToTripDayFields({
        staff: String(t.staff_count ?? ""),
        helper: String(t.helper_count ?? ""),
        equipmentUsed: t.equipment_used === true,
        place: String(t.equipment_place ?? ""),
        hours: String(t.equipment_hours ?? ""),
        note: String(t.note ?? ""),
      }),
    });
  }
  return trips;
}

export async function saveDayWorkLogs(formData: FormData): Promise<{ redirectTo: string | null; error: string | null }> {
  const supabase = await createClient();
  const logDate = String(formData.get("log_date"));
  const trips = parseTrips(formData);

  // 출장일지 표(090)를 먼저 확인 — 표가 없는데 출장을 체크했으면 작업일지를 건드리기 전에 알려 줌.
  const existingTrips = await supabase.from("trip_log_days").select("id, project_id").eq("work_date", logDate);
  const tripTableReady = !existingTrips.error;
  if (!tripTableReady && trips.length > 0) {
    return {
      redirectTo: null,
      error: "출장일지 표가 아직 없습니다 — Supabase SQL Editor에서 090_trip_log_days.sql을 먼저 실행해 주세요.",
    };
  }

  const del = await supabase.from("work_logs").delete().eq("log_date", logDate);
  if (del.error) return { redirectTo: null, error: del.error.message };

  const rows = [];
  for (let i = 0; i < 5; i++) {
    const title = String(formData.get(`title_${i}`) ?? "").trim();
    const siteId = String(formData.get(`site_id_${i}`) ?? "") || null;
    const projectId = String(formData.get(`project_id_${i}`) ?? "") || null;
    // 현장만 선택하고 내용은 비워둔 줄도 저장 — 같은 현장 작업이 이어지는 날을
    // 매번 내용 재입력 없이 색으로만 표시할 수 있게.
    if (!title && !siteId) continue;
    rows.push({ log_date: logDate, title, site_id: siteId, project_id: projectId, sort_order: i });
  }
  if (rows.length) {
    const ins = await supabase.from("work_logs").insert(rows);
    if (ins.error) return { redirectTo: null, error: ins.error.message };
  }

  // 출장일지 맞추기: 저장된 줄에 남은 프로젝트만 이 날짜 출장으로(인원·장비는 덮어씀), 체크를 뺀 프로젝트는 이 날짜에서 뺌.
  if (tripTableReady) {
    const savedProjects = new Set(rows.map((r) => r.project_id).filter((id): id is string => Boolean(id)));
    const tripRows = trips
      .filter((t) => savedProjects.has(t.project_id))
      .map((t) => ({ ...t, work_date: logDate, updated_at: new Date().toISOString() }));
    if (tripRows.length) {
      const up = await supabase.from("trip_log_days").upsert(tripRows, { onConflict: "project_id,work_date" });
      if (up.error) return { redirectTo: null, error: up.error.message };
    }
    const keep = new Set(tripRows.map((t) => t.project_id));
    const staleIds = (existingTrips.data ?? []).filter((t) => !keep.has(t.project_id)).map((t) => t.id);
    if (staleIds.length) {
      const rm = await supabase.from("trip_log_days").delete().in("id", staleIds);
      if (rm.error) return { redirectTo: null, error: rm.error.message };
    }
  }

  const [year, month] = logDate.split("-");
  revalidatePath("/worklogs");
  // 커스텀 확인 팝업(비동기) 도입 이후로는 네이티브 <form action>을 통해 호출되지 않고
  // 클라이언트에서 직접 호출하므로, 여기서 redirect()를 던지면 깨짐 — 경로만 반환하고
  // 이동은 호출한 쪽(WorkLogForm)에서 router.push로 처리.
  return { redirectTo: `/worklogs?year=${Number(year)}&month=${Number(month)}`, error: null };
}

export type WorkLogDetailEntry = { id: string; log_date: string; content: string | null };

/**
 * 작업 집계 표에서 특정 (현장, 내용) 묶음을 클릭했을 때 그 해 전체에서 실제로
 * 해당하는 날짜들을 뽑아준다. 집계(buildWorkLogSummary)와 같은 내용 이어받기 규칙
 * (resolveWorkLogTitles)을 그대로 써서 집계 결과와 일치시킨다.
 */
export async function getWorkLogGroupDetail(year: number, siteId: string, title: string): Promise<WorkLogDetailEntry[]> {
  const supabase = await createClient();
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  // 현장 없는 묶음 = 휴무·사내·기타 — 집계처럼 현장과 상관없이 그 내용을 적은 줄.
  if (!siteId) {
    const data = await fetchAllRows<{ id: string; log_date: string; title: string | null; content: string | null }>(
      (from, to) =>
        supabase
          .from("work_logs")
          .select("id, log_date, title, content")
          .eq("title", title)
          .gte("log_date", start)
          .lte("log_date", end)
          .order("log_date", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to)
    );
    return data.map((r) => ({ id: r.id, log_date: r.log_date, content: r.content }));
  }

  const data = await fetchSiteLogs(supabase, siteId, start, end);
  return resolveWorkLogTitles(data)
    .filter((r) => r.title === title && !(r.source === "explicit" && SPECIAL_TITLES.includes(r.title)))
    .map(({ row }) => ({ id: row.id, log_date: row.log_date, content: row.content }));
}

export async function updateWorkLogMemo(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const content = String(formData.get("content") ?? "").trim() || null;
  const { error } = await supabase.from("work_logs").update({ content }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/worklogs");
  revalidatePath("/reports");
}

/**
 * 작업 집계 팝업에서 내용을 고치면, 그 해에 같은 현장·같은 내용으로 명시 입력된 모든
 * 행을 한 번에 새 이름으로 바꾼다. 내용을 비워두고 이어받은(carry-forward) 행들은 손댈
 * 필요가 없다 — 다음에 집계할 때 마지막 명시 내용을 새로 바뀐 값으로 다시 이어받는다.
 * 단, 적은 내용 없이 프로젝트 이름으로 묶인 행들은 새 이름을 직접 넣는다(아래).
 */
export async function renameWorkLogTitle(formData: FormData) {
  const supabase = await createClient();
  const siteId = String(formData.get("site_id") ?? "") || null;
  const oldTitle = String(formData.get("old_title") ?? "").trim();
  const newTitle = String(formData.get("new_title") ?? "").trim();
  const year = Number(formData.get("year"));
  if (!oldTitle || !newTitle || !year) return { error: "입력값을 확인해주세요." };

  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const base = supabase
    .from("work_logs")
    .update({ title: newTitle })
    .eq("title", oldTitle)
    .gte("log_date", start)
    .lte("log_date", end);

  // 내용을 적은 줄이 하나도 없어 프로젝트 이름으로 묶인 줄들은, 고친 이름을 그 줄들의 내용으로 직접 넣음
  // (적은 줄이 없으니 이름만 바꿔서는 이어받을 곳이 없음). 아래에서 적은 줄 이름을 바꾸기 전에 찾아 둠.
  let projectNamedIds: string[] = [];
  if (siteId) {
    const rows = await fetchSiteLogs(supabase, siteId, start, end);
    projectNamedIds = resolveWorkLogTitles(rows)
      .filter((r) => r.source === "project" && r.title === oldTitle)
      .map(({ row }) => row.id);
  }

  const { error } = siteId ? await base.eq("site_id", siteId) : await base.is("site_id", null);
  if (error) return { error: error.message };

  if (projectNamedIds.length > 0) {
    const { error: namedError } = await supabase.from("work_logs").update({ title: newTitle }).in("id", projectNamedIds);
    if (namedError) return { error: namedError.message };
  }

  revalidatePath("/worklogs");
  revalidatePath("/reports");
}

export type SiteWorkLogEntry = { log_date: string; title: string };
export type SiteWorkLogDetail = { jobTypeCount: number; dayCount: number; entries: SiteWorkLogEntry[] };

/**
 * 현장집계에서 현장을 클릭했을 때, 지정한 연도·월 범위 안에서 그 현장의 실제 작업
 * 내역을 날짜순으로 뽑아준다 — 내용이 빈 줄은 작업 집계와 같은 규칙(resolveWorkLogTitles,
 * 그 해 1월 1일부터 이어받기)으로 정하고, 휴무·사내·기타는 현장집계처럼 뺀다.
 */
export async function getSiteWorkLogDetail(
  year: number,
  siteId: string,
  monthStart: number,
  monthEnd: number
): Promise<SiteWorkLogDetail> {
  const supabase = await createClient();
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = `${year}-${pad(monthStart)}-01`;
  const lastDay = new Date(year, monthEnd, 0).getDate();
  const end = `${year}-${pad(monthEnd)}-${pad(lastDay)}`;

  const data = await fetchSiteLogs(supabase, siteId, `${year}-01-01`, end);

  const entries: SiteWorkLogEntry[] = [];
  const titles = new Set<string>();
  const dates = new Set<string>();
  for (const { row, title, source } of resolveWorkLogTitles(data)) {
    if (row.log_date < start || !title) continue;
    if (source === "explicit" && SPECIAL_TITLES.includes(title)) continue;
    entries.push({ log_date: row.log_date, title });
    titles.add(title);
    dates.add(row.log_date);
  }

  return { jobTypeCount: titles.size, dayCount: dates.size, entries };
}
