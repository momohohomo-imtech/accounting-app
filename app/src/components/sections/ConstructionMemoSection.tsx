import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { ConstructionMemoFilter } from "@/components/ConstructionMemoFilter";
import type { ProjectTreeNode } from "@/components/ProjectTreeFilter";
import { ConstructionMemoList } from "@/components/ConstructionMemoList";
import {
  createConstructionMemo,
  updateConstructionMemo,
  deleteConstructionMemo,
} from "@/lib/actions/constructionMemos";
import { KnowHowSection } from "@/components/KnowHowSection";
import { createKnowHowNote, updateKnowHowNote, deleteKnowHowNote } from "@/lib/actions/knowHow";

type MemoRow = { id: string; content: string; created_at: string; updated_at: string; project_name?: string };

export async function ConstructionMemoSection({
  year,
  client,
  siteId,
  projectId,
}: {
  year?: string;
  client?: string;
  siteId?: string;
  projectId?: string;
}) {
  const supabase = await createClient();
  const { data: projectTree } = await supabase
    .from("projects")
    .select("id, name, year, site_id, sites(name, clients(name))")
    .order("name");

  const projectNodes: ProjectTreeNode[] = (projectTree ?? []).map((p) => {
    const site = one(p.sites) as { name: string; clients?: unknown } | undefined;
    const clientObj = one(site?.clients) as { name: string } | undefined;
    return {
      id: p.id,
      name: p.name,
      year: p.year,
      siteId: p.site_id,
      siteName: site?.name ?? "미지정",
      clientName: clientObj?.name ?? null,
    };
  });

  const selectedYear = year ?? "all";
  const selectedClient = client ?? "all";
  const selectedSiteId = siteId ?? "all";
  const selectedProjectId = projectId ?? "";

  // 연도만 고르면 그 해 전체, 현장까지 고르면 그 현장 전체, 프로젝트까지 고르면
  // 그 프로젝트만 — 단계별로 점점 좁혀서 메모를 모아 보여줌.
  let scopedProjects = projectNodes;
  if (selectedYear !== "all") scopedProjects = scopedProjects.filter((p) => String(p.year) === selectedYear);
  if (selectedClient !== "all")
    scopedProjects = scopedProjects.filter((p) => (p.clientName ?? "미지정") === selectedClient);
  if (selectedSiteId !== "all") scopedProjects = scopedProjects.filter((p) => p.siteId === selectedSiteId);
  if (selectedProjectId) scopedProjects = scopedProjects.filter((p) => p.id === selectedProjectId);

  const matchingProjectIds = scopedProjects.map((p) => p.id);
  const hasFilter = selectedYear !== "all" || selectedSiteId !== "all" || Boolean(selectedProjectId);
  const projectNameById = new Map(projectNodes.map((p) => [p.id, p.name]));

  const [{ data: memosRaw }, { data: knowHowNotes }] = await Promise.all([
    hasFilter && matchingProjectIds.length > 0
      ? supabase
          .from("construction_memos")
          .select("id, content, created_at, updated_at, project_id")
          .in("project_id", matchingProjectIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; content: string; created_at: string; updated_at: string; project_id: string }[] }),
    supabase
      .from("know_how_notes")
      .select("*")
      .eq("category", "construction")
      .order("created_at", { ascending: false }),
  ]);

  const memos: MemoRow[] = (memosRaw ?? []).map((m) => ({
    id: m.id,
    content: m.content,
    created_at: m.created_at,
    updated_at: m.updated_at,
    // 프로젝트를 아직 특정하지 않고 연도/현장 단위로 모아볼 때만 어느 프로젝트
    // 메모인지 표시(프로젝트를 이미 콕 집었으면 굳이 반복 표시 안 함).
    project_name: selectedProjectId ? undefined : (projectNameById.get(m.project_id) ?? ""),
  }));

  async function createKnowHowBound(formData: FormData) {
    "use server";
    formData.set("category", "construction");
    return createKnowHowNote(formData);
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">공사 메모 — 프로젝트별 진행 상황 기록</h2>
        <ConstructionMemoFilter
          basePath="/quality-construction"
          projects={projectNodes}
          selectedYear={selectedYear}
          selectedClient={selectedClient}
          selectedSiteId={selectedSiteId}
          selectedProjectId={selectedProjectId}
        />
      </div>

      {!hasFilter ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          위에서 연도(또는 현장·프로젝트)를 선택하면 메모를 볼 수 있어요.
        </p>
      ) : matchingProjectIds.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          조건에 맞는 프로젝트가 없습니다.
        </p>
      ) : (
        <ConstructionMemoList
          projectId={selectedProjectId || undefined}
          memos={memos}
          createAction={createConstructionMemo}
          updateAction={updateConstructionMemo}
          deleteAction={deleteConstructionMemo}
        />
      )}

      <KnowHowSection
        title="공사관리 노하우"
        notes={(knowHowNotes ?? []) as unknown as { id: string; title: string; content: string | null; memo: string | null; created_at: string }[]}
        createAction={createKnowHowBound}
        updateAction={updateKnowHowNote}
        deleteAction={deleteKnowHowNote}
      />
    </div>
  );
}
