import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { fetchAllData, fetchAllRows } from "@/lib/supabaseFetchAll";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import type { SiteOption } from "@/components/ProjectPicker";
import { WorkSequenceList, type WorkSequenceListRow } from "@/components/WorkSequenceList";
import { WorkSequenceEditor, type WorkSequenceData } from "@/components/WorkSequenceEditor";
import { doneCount, scheduleSteps, sequenceRangeLabel, type SequenceUnit } from "@/lib/workSequence";

const BASE = "/quality-construction?tab=sequence";
const MISSING_TABLE = new Set(["PGRST205", "42P01"]);

type SequenceRow = {
  id: string;
  project_id: string;
  title: string;
  unit: SequenceUnit;
  start_date: string | null;
  start_time: string | null;
  updated_at: string;
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
};

// 공사 관리 "공사 작업 순서" 탭(사용자 요청 11/2, 098 SQL) — 순서표 목록 + 순서표 팝업(?seq=아이디, 새로 쓰기는 ?seq=new).
export async function WorkSequenceSection({ seq }: { seq?: string }) {
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
    fetchAllRows<SequenceRow>((from, to) =>
      supabase
        .from("work_sequences")
        .select("id, project_id, title, unit, start_date, start_time, updated_at, projects(name, sites(name))")
        .order("id")
        .range(from, to)
    ),
    fetchAllRows<StepRow>((from, to) =>
      supabase
        .from("work_sequence_steps")
        .select("id, sequence_id, sort_order, content, detail, duration, overlap, done, done_date")
        .order("id")
        .range(from, to)
    ),
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

  const stepsBySequence = new Map<string, WorkSequenceData["steps"]>();
  for (const s of [...steps].sort((a, b) => a.sort_order - b.sort_order)) {
    const list = stepsBySequence.get(s.sequence_id) ?? [];
    list.push({
      id: s.id,
      content: s.content,
      detail: s.detail ?? "",
      duration: Number(s.duration),
      overlap: Number(s.overlap),
      done: s.done,
      done_date: s.done_date,
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
    steps: stepsBySequence.get(r.id) ?? [],
  });

  const rows: WorkSequenceListRow[] = sequences.map((r) => {
    const data = toData(r);
    const project = one(r.projects) as { name: string; sites?: unknown } | undefined;
    const site = one(project?.sites) as { name: string } | undefined;
    return {
      id: r.id,
      project_name: project?.name ?? "(삭제된 프로젝트)",
      site_name: site?.name ?? "현장 미지정",
      title: r.title,
      unit: data.unit,
      start_date: r.start_date ?? "",
      rangeLabel: sequenceRangeLabel(scheduleSteps(data.steps), data),
      stepCount: data.steps.length,
      doneCount: doneCount(data.steps),
      updated_at: r.updated_at,
    };
  });

  const openRow = seq && seq !== "new" ? sequences.find((r) => r.id === seq) : undefined;
  const editorData: WorkSequenceData | null =
    seq === "new"
      ? { id: "", project_id: "", title: "", unit: "day", start_date: null, start_time: null, steps: [] }
      : openRow
        ? toData(openRow)
        : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">공사 작업 순서 — 프로젝트별 작업 순서·흐름 차트</h2>
        <LinkButton href={`${BASE}&seq=new`} scroll={false}>
          + 순서표 작성
        </LinkButton>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <WorkSequenceList rows={rows} openHref={`${BASE}&seq=`} />
      </div>
      {seq && !editorData && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          열려던 순서표를 찾지 못했습니다(삭제됐을 수 있음).
        </p>
      )}
      {editorData && (
        <WorkSequenceEditor
          key={seq}
          initial={editorData}
          isNew={seq === "new"}
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
        />
      )}
    </div>
  );
}
