import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { fetchAllData, fetchAllRows } from "@/lib/supabaseFetchAll";
import { Card } from "@/components/ui/Card";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { WorkSequenceAgenda, WorkTeamSchedule } from "@/components/WorkSequenceOverview";
import { LinkButton } from "@/components/ui/Button";
import type { SiteOption } from "@/components/ProjectPicker";
import { WorkSequenceList, type WorkSequenceListRow } from "@/components/WorkSequenceList";
import { WorkSequenceEditor, type WorkSequenceData } from "@/components/WorkSequenceEditor";
import { WorkSequenceFilter } from "@/components/WorkSequenceFilter";
import { nowKstParts } from "@/lib/kstDate";
import { buildAgenda, teamSchedule, type OverviewSequence } from "@/lib/workSequenceOverview";
import {
  SEQ_FILTER_ALL,
  SEQ_NO_SITE,
  matchesSequenceFilter,
  parseSequenceFilter,
  sequenceFilterQuery,
  sequenceYearOptions,
  sequenceYears,
  yearParamInAddress,
} from "@/lib/workSequenceFilter";
import {
  doneCount,
  forecastSchedule,
  forecastSummary,
  parseTeams,
  scheduleSteps,
  sequenceRangeLabel,
  summarizeSequence,
  type SequenceUnit,
  type StepAfter,
  type TeamColorKey,
} from "@/lib/workSequence";

const BASE = "/quality-construction?tab=sequence";
const MISSING_TABLE = new Set(["PGRST205", "42P01"]);
const MISSING_COLUMN = new Set(["PGRST204", "42703"]);

type SequenceRow = {
  id: string;
  project_id: string;
  title: string;
  unit: SequenceUnit;
  start_date: string | null;
  start_time: string | null;
  updated_at: string;
  /** 팀 목록(100 SQL) — 실행 전엔 없음 */
  teams?: unknown;
  /** 순서표 메모(103 SQL) — 실행 전엔 없음 */
  memo?: string | null;
  projects:
    | { name: string; year: number | null; site_id: string | null; sites: { name: string } | { name: string }[] | null }
    | { name: string; year: number | null; site_id: string | null; sites: unknown }[]
    | null;
};
type StepRow = {
  id: string;
  sequence_id: string;
  sort_order: number;
  content: string;
  detail: string | null;
  duration: number | string;
  overlap: number | string;
  done: boolean;
  done_date: string | null;
  after_step_id?: string | null;
  after_start?: boolean;
  team_id?: string | null;
};

// 공사 관리 "공사 작업 순서" 탭(사용자 요청 11/2, 098·099·100 SQL) — 모아 보기(오늘·이번 주 할 일, 팀별 2주 일정 — 11/3) + 순서표
// 목록 + 순서표 팝업(?seq=아이디, 새로 쓰기 ?seq=new, 복사해서 새로 쓰기 ?seq=new&copyFrom=아이디).
// 11/4 사용자 요청: 할 일·팀별 일정은 늘 접힌 채로 시작(제목 줄에 늦은 작업·겹침 요약), 순서표 목록은 펼침 + 연도·현장 필터(기본 올해·
// 현장 전체, 주소 seqYear·seqSite — lib/workSequenceFilter.ts) — 할 일·팀별 일정·목록에 같이 적용, 팝업을 열고 닫아도 필터 그대로.
export async function WorkSequenceSection({
  seq,
  copyFrom,
  seqYear,
  seqSite,
}: {
  seq?: string;
  copyFrom?: string;
  seqYear?: string;
  seqSite?: string;
}) {
  const supabase = await createClient();
  // 098 SQL 실행 전이면 안내만
  const probe = await supabase.from("work_sequences").select("id", { count: "exact", head: true });
  if (probe.error && MISSING_TABLE.has(probe.error.code ?? "")) {
    return (
      <Card padding="lg" className="text-center text-sm text-slate-500">
        공사 작업 순서를 쓰려면 Supabase SQL Editor에서 <span className="font-medium text-slate-700">098_work_sequences.sql</span>을 한 번
        실행해 주세요(새 표만 추가 — 기존 자료는 그대로).
      </Card>
    );
  }
  // 099 SQL(앞 작업 칸) 실행 전이면 앞 작업 칸 없이(지금처럼 바로 앞 단계 뒤로만), 100 SQL(팀 칸) 실행 전이면 팀 없이,
  // 103 SQL(메모 칸) 실행 전이면 메모 없이
  const [depProbe, teamProbe, stepTeamProbe, memoProbe] = await Promise.all([
    supabase.from("work_sequence_steps").select("after_step_id, after_start").limit(1),
    supabase.from("work_sequences").select("teams").limit(1),
    supabase.from("work_sequence_steps").select("team_id").limit(1),
    supabase.from("work_sequences").select("memo").limit(1),
  ]);
  const missingColumn = (r: { error: { code?: string } | null }) => Boolean(r.error && MISSING_COLUMN.has(r.error.code ?? ""));
  const dependencyReady = !missingColumn(depProbe);
  const teamsReady = !missingColumn(teamProbe) && !missingColumn(stepTeamProbe);
  const memoReady = !missingColumn(memoProbe);

  const [{ data: projectsRaw }, { data: sitesRaw }, sequences, steps] = await Promise.all([
    fetchAllData((from, to) =>
      supabase
        .from("projects")
        .select("id, name, site_id, status, year, project_code, sites(name)")
        .order("name")
        .order("id")
        .range(from, to)
    ),
    fetchAllData((from, to) =>
      supabase.from("sites").select("id, name, clients(name)").order("name").order("id").range(from, to)
    ),
    // 칸 전부(*) — 099·100 SQL 실행 여부와 상관없이 있는 칸만 옴(앞 작업·팀 칸은 위 확인으로 씀)
    fetchAllRows<SequenceRow>((from, to) =>
      supabase.from("work_sequences").select("*, projects(name, year, site_id, sites(name))").order("id").range(from, to)
    ),
    fetchAllRows<StepRow>((from, to) => supabase.from("work_sequence_steps").select("*").order("id").range(from, to)),
  ]);

  const siteOptions: SiteOption[] = (sitesRaw ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    client_name: (one(s.clients) as { name: string } | undefined)?.name ?? null,
  }));
  const projectLabels: Record<string, string> = {};
  for (const p of projectsRaw ?? []) {
    const site = one(p.sites) as { name: string } | undefined;
    projectLabels[p.id] = `${site?.name ?? "현장 미지정"} · ${p.name}`;
  }

  const teamsBySequence = new Map(sequences.map((r) => [r.id, teamsReady ? parseTeams(r.teams) : []]));
  const stepsBySequence = new Map<string, WorkSequenceData["steps"]>();
  for (const s of [...steps].sort((a, b) => a.sort_order - b.sort_order)) {
    const teamIds = new Set((teamsBySequence.get(s.sequence_id) ?? []).map((t) => t.id));
    const list = stepsBySequence.get(s.sequence_id) ?? [];
    list.push({
      id: s.id,
      content: s.content,
      detail: s.detail ?? "",
      duration: Number(s.duration),
      overlap: Number(s.overlap),
      done: s.done,
      done_date: s.done_date,
      after_step_id: dependencyReady ? s.after_step_id ?? null : null,
      after_start: dependencyReady ? Boolean(s.after_start) : false,
      // 목록에 없는 팀(지운 팀)은 팀 미정
      team_id: teamsReady && s.team_id && teamIds.has(s.team_id) ? s.team_id : null,
    });
    stepsBySequence.set(s.sequence_id, list);
  }
  const toData = (r: SequenceRow): WorkSequenceData => ({
    id: r.id,
    project_id: r.project_id,
    title: r.title,
    unit: r.unit === "hour" ? "hour" : "day",
    start_date: r.start_date,
    start_time: r.start_time ? r.start_time.slice(0, 5) : null,
    teams: teamsBySequence.get(r.id) ?? [],
    memo: memoReady ? r.memo ?? "" : "",
    steps: stepsBySequence.get(r.id) ?? [],
  });

  // 목록 상태(지연 N단계 등)는 서버의 한국 시각 오늘 기준
  const today = nowKstParts();
  const scheduleOf = (data: WorkSequenceData) => {
    const index = new Map(data.steps.map((s, i) => [s.id, i]));
    return scheduleSteps(
      data.steps.map((s) => {
        const after: StepAfter = !dependencyReady
          ? null
          : s.after_start
            ? "start"
            : s.after_step_id && index.has(s.after_step_id)
              ? index.get(s.after_step_id)!
              : null;
        return { duration: s.duration, overlap: s.overlap, after };
      })
    );
  };

  // 연도·현장 필터(기본 올해·현장 전체) — 팝업 주소에도 붙여서 열고 닫아도 그대로
  const currentYear = Number(today.date.slice(0, 4));
  const filter = parseSequenceFilter({ seqYear, seqSite }, currentYear);
  const base = `${BASE}${sequenceFilterQuery(filter, yearParamInAddress(seqYear))}`;

  // 모아 보기 — 최근에 고친 순서표가 먼저(같은 이름 팀의 색은 그 순서표 것)
  const entries = [...sequences]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .map((r) => {
      const data = toData(r);
      const schedule = scheduleOf(data);
      const project = one(r.projects) as { name: string; year?: number | null; site_id?: string | null; sites?: unknown } | undefined;
      const site = one(project?.sites) as { name: string } | undefined;
      const seqStart = { unit: data.unit, start_date: data.start_date, start_time: data.start_time };
      const summary = forecastSummary(forecastSchedule(data.steps, schedule, seqStart, today), schedule, seqStart, data.steps);
      const overviewItem: OverviewSequence = {
        id: r.id,
        title: r.title,
        projectLabel: `${site?.name ?? "현장 미지정"} · ${project?.name ?? "(삭제된 프로젝트)"}`,
        seq: seqStart,
        teams: data.teams,
        steps: data.steps,
        schedule,
      };
      const row: WorkSequenceListRow = {
        id: r.id,
        project_name: project?.name ?? "(삭제된 프로젝트)",
        site_name: site?.name ?? "현장 미지정",
        title: r.title,
        unit: data.unit,
        start_date: r.start_date ?? "",
        rangeLabel: sequenceRangeLabel(schedule, data),
        stepCount: data.steps.length,
        doneCount: doneCount(data.steps),
        status: summarizeSequence(data.steps, schedule, data, today),
        forecast: summary
          ? { endKey: summary.endKey, endLabel: summary.endLabel, delay: summary.delay, allDone: summary.allDone }
          : null,
        updated_at: r.updated_at,
      };
      return {
        overview: overviewItem,
        row,
        years: sequenceYears(seqStart, schedule, summary?.forecastEnd, project?.year ?? null),
        siteId: project?.site_id ?? null,
        siteName: site?.name ?? null,
      };
    });
  const visible = entries.filter((e) => matchesSequenceFilter(e, filter));
  const rows = visible.map((e) => e.row);
  const overview = visible.map((e) => e.overview);
  const agenda = buildAgenda(overview, today);
  const team = teamSchedule(overview, today, 14);

  // 필터 선택 목록 — 순서표가 있는 해·현장(고른 값이 목록에 없으면 같이 — 선택칸이 빈칸으로 안 보이게)
  const filterYears = sequenceYearOptions(
    entries.map((e) => e.years),
    currentYear,
    filter.year
  );
  const siteNames = new Map<string, string>();
  let hasNoSite = false;
  for (const e of entries) {
    if (e.siteId) siteNames.set(e.siteId, e.siteName ?? "(이름 없는 현장)");
    else hasNoSite = true;
  }
  if (filter.site !== SEQ_FILTER_ALL && filter.site !== SEQ_NO_SITE && !siteNames.has(filter.site)) {
    siteNames.set(filter.site, (sitesRaw ?? []).find((x) => x.id === filter.site)?.name ?? "(없는 현장)");
  }
  const filterSites = [...siteNames].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  if (hasNoSite || filter.site === SEQ_NO_SITE) filterSites.push({ id: SEQ_NO_SITE, name: "현장 미지정" });

  // 다른 순서표에서 쓴 팀 이름·색(최근에 고친 순서표 것이 먼저) — 팀을 추가할 때 골라 쓰기(색도 그때 색)
  const knownTeams: { name: string; color: TeamColorKey }[] = [];
  const seenTeamNames = new Set<string>();
  for (const r of [...sequences].sort((a, b) => b.updated_at.localeCompare(a.updated_at))) {
    for (const t of teamsBySequence.get(r.id) ?? []) {
      if (seenTeamNames.has(t.name)) continue;
      seenTeamNames.add(t.name);
      knownTeams.push({ name: t.name, color: t.color });
    }
  }
  knownTeams.sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const openRow = seq && seq !== "new" ? sequences.find((r) => r.id === seq) : undefined;
  const copySource = seq === "new" && copyFrom ? sequences.find((r) => r.id === copyFrom) : undefined;
  let editorData: WorkSequenceData | null = null;
  if (seq === "new") {
    editorData = copySource
      ? // 복사: 단계·기간·겹침·앞 작업·팀·메모는 그대로, 프로젝트·시작일은 새로 정하게 비움(완료 체크는 화면이 비움)
        { ...toData(copySource), project_id: "", start_date: null }
      : { id: "", project_id: "", title: "", unit: "day", start_date: null, start_time: null, teams: [], memo: "", steps: [] };
  } else if (openRow) editorData = toData(openRow);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">공사 작업 순서 — 프로젝트별 작업 순서·흐름 차트</h2>
        <LinkButton href={`${base}&seq=new`} scroll={false}>
          + 순서표 작성
        </LinkButton>
      </div>
      {sequences.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <WorkSequenceFilter
            basePath="/quality-construction"
            years={filterYears}
            selectedYear={filter.year}
            sites={filterSites}
            selectedSite={filter.site}
          />
          {visible.length !== entries.length && (
            <span className="text-xs text-slate-500">
              전체 {entries.length}개 중 {visible.length}개
            </span>
          )}
        </div>
      )}
      {!dependencyReady && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          단계마다 &ldquo;앞 작업&rdquo;(어느 단계 뒤에 — 동시에 여러 작업)을 고르려면 Supabase SQL Editor에서{" "}
          <span className="font-medium">099_work_sequence_after.sql</span>을 실행해 주세요(칸 2개만 추가 — 기존 자료는 그대로).
        </p>
      )}
      {!teamsReady && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          팀별 색(분업)을 쓰려면 Supabase SQL Editor에서 <span className="font-medium">100_work_sequence_teams.sql</span>을 실행해
          주세요(칸 2개만 추가 — 기존 자료는 그대로).
        </p>
      )}
      {!memoReady && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          순서표마다 메모(작업 지시사항·전달사항)를 쓰려면 Supabase SQL Editor에서{" "}
          <span className="font-medium">103_work_sequence_memo.sql</span>을 실행해 주세요(칸 1개만 추가 — 기존 자료는 그대로).
        </p>
      )}
      {visible.length > 0 && (
        <CollapsibleSection
          title={
            <>
              오늘·이번 주 할 일
              {agenda.overdue.length > 0 && <span className="ml-1.5 text-sm text-red-600">· 늦은 작업 {agenda.overdue.length}</span>}
            </>
          }
        >
          <WorkSequenceAgenda agenda={agenda} todayDate={today.date} openHref={`${base}&seq=`} />
        </CollapsibleSection>
      )}
      {visible.length > 0 && (
        <CollapsibleSection
          title={
            <>
              팀별 일정 — 앞으로 2주
              {team.rows.some((r) => r.conflicts.length > 0) && <span className="ml-1.5 text-sm text-amber-700">· 다른 순서표와 겹침</span>}
            </>
          }
        >
          <WorkTeamSchedule days={team.days} rows={team.rows} openHref={`${base}&seq=`} />
        </CollapsibleSection>
      )}
      <CollapsibleSection defaultOpen title={`작업 순서표 목록 ${rows.length}개`}>
        <WorkSequenceList
          rows={rows}
          openHref={`${base}&seq=`}
          copyHref={`${base}&seq=new&copyFrom=`}
          emptyText={entries.length > 0 ? "고른 연도·현장에 작업 순서표가 없습니다." : undefined}
        />
      </CollapsibleSection>
      {seq && !editorData && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          열려던 순서표를 찾지 못했습니다(삭제됐을 수 있음).
        </p>
      )}
      {editorData && (
        <WorkSequenceEditor
          key={`${seq}:${copyFrom ?? ""}`}
          initial={editorData}
          isNew={seq === "new"}
          copyOfTitle={copySource?.title ?? null}
          dependencyReady={dependencyReady}
          teamsReady={teamsReady}
          memoReady={memoReady}
          knownTeams={knownTeams}
          sites={siteOptions}
          projects={(projectsRaw ?? []).map((p) => ({
            id: p.id,
            name: p.name,
            site_id: p.site_id,
            status: p.status,
            year: p.year,
            project_code: p.project_code,
          }))}
          projectLabels={projectLabels}
          closeHref={base}
          savedHref={`${base}&seq=`}
          copyHref={`${base}&seq=new&copyFrom=`}
        />
      )}
    </div>
  );
}
