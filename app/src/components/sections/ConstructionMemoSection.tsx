import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { ConstructionMemoFilter } from "@/components/ConstructionMemoFilter";
import { ConstructionMemoList } from "@/components/ConstructionMemoList";
import type { SiteOption } from "@/components/ProjectPicker";
import {
  createConstructionMemo,
  updateConstructionMemo,
  deleteConstructionMemo,
} from "@/lib/actions/constructionMemos";
import { fetchAllRows } from "@/lib/supabaseFetchAll";
import { nowKst } from "@/lib/kstDate";

type MemoRow = {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
  project_id: string;
  project_name: string;
  site_id: string;
  site_name: string;
};

export async function ConstructionMemoSection({
  year,
  siteId,
  month,
}: {
  year?: string;
  siteId?: string;
  month?: string;
}) {
  const supabase = await createClient();
  type MemoRawRow = {
    id: string;
    content: string;
    created_at: string;
    updated_at: string;
    project_id: string;
    projects:
      | { name: string; site_id: string; sites: { name: string } | { name: string }[] | null }
      | { name: string; site_id: string; sites: { name: string } | { name: string }[] | null }[]
      | null;
  };
  const [{ data: projectsRaw }, { data: sitesRaw }, memosRaw] = await Promise.all([
    // status/year/project_code는 ProjectPicker가 "완료 프로젝트 보기" 토글에 씀 —
    // 메모 추가 팝업에서 완료 프로젝트도 고를 수 있어야 해서 필요함.
    supabase.from("projects").select("id, name, site_id, status, year, project_code").order("name"),
    supabase.from("sites").select("id, name, clients(name)").order("name"),
    fetchAllRows<MemoRawRow>((from, to) =>
      supabase
        .from("construction_memos")
        .select("id, content, created_at, updated_at, project_id, projects(name, site_id, sites(name))")
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to)
    ),
  ]);

  const siteOptions: SiteOption[] = (sitesRaw ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    client_name: (one(s.clients) as { name: string } | undefined)?.name ?? null,
  }));

  const allMemos: MemoRow[] = memosRaw.map((m) => {
    const project = one(m.projects) as { name: string; site_id: string; sites?: unknown } | undefined;
    const site = one(project?.sites) as { name: string } | undefined;
    return {
      id: m.id,
      content: m.content,
      created_at: m.created_at,
      updated_at: m.updated_at,
      project_id: m.project_id,
      project_name: project?.name ?? "(삭제된 프로젝트)",
      site_id: project?.site_id ?? "",
      site_name: site?.name ?? "미지정",
    };
  });

  // 파라미터가 아예 없으면(처음 진입) 올해를 기본으로 보여주고, "전체"는
  // 사용자가 명시적으로 골랐을 때만(URL에 year=all로 남음) 전체 연도를 보여줌.
  const currentYear = nowKst().year;
  const selectedYear = year ?? String(currentYear);
  const selectedSiteId = siteId ?? "all";
  const selectedMonth = month ?? "all";

  // 작성 시각을 서버 시간대가 아니라 한국 시간(UTC+9) 기준 연/월로 — 월초 새벽에 쓴 메모가 전달로 분류되지 않게.
  const kst = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000);
  const years = Array.from(new Set(allMemos.map((m) => kst(m.created_at).getUTCFullYear())));
  if (!years.includes(currentYear)) years.push(currentYear);
  years.sort((a, b) => b - a);

  let memos = allMemos;
  if (selectedYear !== "all") memos = memos.filter((m) => kst(m.created_at).getUTCFullYear() === Number(selectedYear));
  if (selectedSiteId !== "all") memos = memos.filter((m) => m.site_id === selectedSiteId);
  if (selectedMonth !== "all") memos = memos.filter((m) => kst(m.created_at).getUTCMonth() + 1 === Number(selectedMonth));

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">공사 메모 — 프로젝트별 진행 상황 기록</h2>
        <ConstructionMemoFilter
          basePath="/quality-construction"
          years={years}
          selectedYear={selectedYear}
          sites={siteOptions}
          selectedSiteId={selectedSiteId}
          selectedMonth={selectedMonth}
        />
      </div>

      <ConstructionMemoList
        memos={memos}
        sites={siteOptions}
        projects={projectsRaw ?? []}
        createAction={createConstructionMemo}
        updateAction={updateConstructionMemo}
        deleteAction={deleteConstructionMemo}
      />
    </div>
  );
}
