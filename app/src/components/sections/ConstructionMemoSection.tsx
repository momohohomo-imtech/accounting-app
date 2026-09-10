import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { ConstructionMemoFilter } from "@/components/ConstructionMemoFilter";
import { ConstructionMemoList } from "@/components/ConstructionMemoList";
import type { ConstructionMemoProjectOption } from "@/components/ConstructionMemoFormPopup";
import {
  createConstructionMemo,
  updateConstructionMemo,
  deleteConstructionMemo,
} from "@/lib/actions/constructionMemos";

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
  const [{ data: projectsRaw }, { data: sites }, { data: memosRaw }] = await Promise.all([
    supabase.from("projects").select("id, name, site_id, sites(name)").order("name"),
    supabase.from("sites").select("id, name").order("name"),
    supabase
      .from("construction_memos")
      .select("id, content, created_at, updated_at, project_id, projects(name, site_id, sites(name))")
      .order("created_at", { ascending: false }),
  ]);

  const projectOptions: ConstructionMemoProjectOption[] = (projectsRaw ?? []).map((p) => {
    const site = one(p.sites) as { name: string } | undefined;
    return { id: p.id, name: p.name, siteName: site?.name ?? "미지정" };
  });

  const allMemos: MemoRow[] = (memosRaw ?? []).map((m) => {
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
  const currentYear = new Date().getFullYear();
  const selectedYear = year ?? String(currentYear);
  const selectedSiteId = siteId ?? "all";
  const selectedMonth = month ?? "all";

  const years = Array.from(new Set(allMemos.map((m) => new Date(m.created_at).getFullYear())));
  if (!years.includes(currentYear)) years.push(currentYear);
  years.sort((a, b) => b - a);

  let memos = allMemos;
  if (selectedYear !== "all") memos = memos.filter((m) => new Date(m.created_at).getFullYear() === Number(selectedYear));
  if (selectedSiteId !== "all") memos = memos.filter((m) => m.site_id === selectedSiteId);
  if (selectedMonth !== "all") memos = memos.filter((m) => new Date(m.created_at).getMonth() + 1 === Number(selectedMonth));

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">공사 메모 — 프로젝트별 진행 상황 기록</h2>
        <ConstructionMemoFilter
          basePath="/quality-construction"
          years={years}
          selectedYear={selectedYear}
          sites={sites ?? []}
          selectedSiteId={selectedSiteId}
          selectedMonth={selectedMonth}
        />
      </div>

      <ConstructionMemoList
        memos={memos}
        projects={projectOptions}
        createAction={createConstructionMemo}
        updateAction={updateConstructionMemo}
        deleteAction={deleteConstructionMemo}
      />
    </div>
  );
}
