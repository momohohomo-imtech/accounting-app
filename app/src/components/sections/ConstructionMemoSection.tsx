import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { ProjectTreeFilter, type ProjectTreeNode } from "@/components/ProjectTreeFilter";
import { ConstructionMemoList } from "@/components/ConstructionMemoList";
import {
  createConstructionMemo,
  updateConstructionMemo,
  deleteConstructionMemo,
} from "@/lib/actions/constructionMemos";
import { KnowHowSection } from "@/components/KnowHowSection";
import { createKnowHowNote, updateKnowHowNote, deleteKnowHowNote } from "@/lib/actions/knowHow";

type MemoRow = { id: string; content: string; created_at: string; updated_at: string };

export async function ConstructionMemoSection({ projectId }: { projectId?: string }) {
  const supabase = await createClient();
  const [{ data: projectTree }, { data: memos }, { data: knowHowNotes }] = await Promise.all([
    supabase.from("projects").select("id, name, year, site_id, sites(name, clients(name))").order("name"),
    projectId
      ? supabase
          .from("construction_memos")
          .select("id, content, created_at, updated_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as MemoRow[] }),
    supabase
      .from("know_how_notes")
      .select("*")
      .eq("category", "construction")
      .order("created_at", { ascending: false }),
  ]);

  const projectNodes: ProjectTreeNode[] = (projectTree ?? []).map((p) => {
    const site = one(p.sites) as { name: string; clients?: unknown } | undefined;
    const client = one(site?.clients) as { name: string } | undefined;
    return {
      id: p.id,
      name: p.name,
      year: p.year,
      siteId: p.site_id,
      siteName: site?.name ?? "미지정",
      clientName: client?.name ?? null,
    };
  });

  async function createKnowHowBound(formData: FormData) {
    "use server";
    formData.set("category", "construction");
    return createKnowHowNote(formData);
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">공사 메모 — 프로젝트별 진행 상황 기록</h2>
        <ProjectTreeFilter basePath="/quality-construction" projects={projectNodes} selectedProjectId={projectId ?? ""} />
      </div>

      {!projectId ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          위에서 프로젝트를 선택하면 메모를 작성하고 볼 수 있어요.
        </p>
      ) : (
        <ConstructionMemoList
          projectId={projectId}
          memos={(memos ?? []) as MemoRow[]}
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
