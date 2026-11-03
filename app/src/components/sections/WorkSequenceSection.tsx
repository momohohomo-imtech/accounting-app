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
import { nowKstParts } from "@/lib/kstDate";
import { buildAgenda, teamSchedule, type OverviewSequence } from "@/lib/workSequenceOverview";
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
  projects: { name: string; sites: { name: string } | { name: string }[] | null } | { name: string; sites: unknown }[] | null;
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
export async function WorkSequenceSection({ seq, copyFrom }: { seq?: string; copyFrom?: string }) {
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
  // 099 SQL(앞 작업 칸) 실행 전이면 앞 작업 칸 없이(지금처럼 바로 앞 단계 뒤로만), 100 SQL(팀 칸) 실행 전이면 팀 없이
  const [depProbe, teamProbe, stepTeamProbe] = await Promise.all([
    supabase.from("work_sequence_steps").select("after_step_id, after_start").limit(1),
    supabase.from("work_sequences").select("teams").limit(1),
    supabase.from("work_sequence_steps").select("team_id").limit(1),
  ]);
  const missingColumn = (r: { error: { code?: string } | null }) => Boolean(r.error && MISSING_COLUMN.has(r.error.code ?? ""));
  const dependencyReady = !missingColumn(depProbe);
  const teamsReady = !missingColumn(teamProbe) && !missingColumn(stepTeamProbe);

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
      supabase.from("work_sequences").select("*, projects(name, sites(name))").order("id").range(from, to)
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

  // 모아 보기 — 최근에 고친 순서표가 먼저(같은 이름 팀의 색은 그 순서표 것)
  const overview: OverviewSequence[] = [];
  const rows: WorkSequenceListRow[] = [...sequences]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .map((r) => {
    const data = toData(r);
    const schedule = scheduleOf(data);
    const project = one(r.projects) as { name: string; sites?: unknown } | undefined;
    const site = one(project?.sites) as { name: string } | undefined;
    const seqStart = { unit: data.unit, start_date: data.start_date, start_time: data.start_time };
    const summary = forecastSummary(forecastSchedule(data.steps, schedule, seqStart, today), schedule, seqStart, data.steps);
    overview.push({
      id: r.id,
      title: r.title,
      projectLabel: `${site?.name ?? "현장 미지정"} · ${project?.name ?? "(삭제된 프로젝트)"}`,
      seq: seqStart,
      teams: data.teams,
      steps: data.steps,
      schedule,
    });
    return {
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
  });
  const agenda = buildAgenda(overview, today);
  const team = teamSchedule(overview, today, 14);

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
      ? // 복사: 단계·기간·겹침·앞 작업은 그대로, 프로젝트·시작일은 새로 정하게 비움(완료 체크는 화면이 비움)
        { ...toData(copySource), project_id: "", start_date: null }
      : { id: "", project_id: "", title: "", unit: "day", start_date: null, start_time: null, teams: [], steps: [] };
  } else if (openRow) editorData = toData(openRow);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">공사 작업 순서 — 프로젝트별 작업 순서·흐름 차트</h2>
        <LinkButton href={`${BASE}&seq=new`} scroll={false}>
          + 순서표 작성
        </LinkButton>
      </div>
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
      {sequences.length > 0 && (
        <CollapsibleSection
          defaultOpen
          title={
            <>
              오늘·이번 주 할 일
              {agenda.overdue.length > 0 && <span className="ml-1.5 text-sm text-red-600">· 늦은 작업 {agenda.overdue.length}</span>}
            </>
          }
        >
          <WorkSequenceAgenda agenda={agenda} todayDate={today.date} openHref={`${BASE}&seq=`} />
        </CollapsibleSection>
      )}
      {sequences.length > 0 && (
        <CollapsibleSection
          defaultOpen={team.rows.length > 0}
          title={
            <>
              팀별 일정 — 앞으로 2주
              {team.rows.some((r) => r.conflicts.length > 0) && <span className="ml-1.5 text-sm text-amber-700">· 다른 순서표와 겹침</span>}
            </>
          }
        >
          <WorkTeamSchedule days={team.days} rows={team.rows} openHref={`${BASE}&seq=`} />
        </CollapsibleSection>
      )}
      <CollapsibleSection defaultOpen title={`작업 순서표 목록 ${sequences.length}개`}>
        <WorkSequenceList rows={rows} openHref={`${BASE}&seq=`} copyHref={`${BASE}&seq=new&copyFrom=`} />
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
          closeHref={BASE}
          savedHref={`${BASE}&seq=`}
          copyHref={`${BASE}&seq=new&copyFrom=`}
        />
      )}
    </div>
  );
}
