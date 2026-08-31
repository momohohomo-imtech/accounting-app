import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { CreatePanel } from "@/components/crud/CreatePanel";
import { EntityTable } from "@/components/crud/EntityTable";
import { ProjectTreeFilter, type ProjectTreeNode } from "@/components/ProjectTreeFilter";
import type { FieldConfig } from "@/components/crud/types";
import {
  createConstructionStage,
  updateConstructionStage,
  deleteConstructionStage,
} from "@/lib/actions/constructionStages";
import { KnowHowSection } from "@/components/KnowHowSection";
import { createKnowHowNote, updateKnowHowNote, deleteKnowHowNote } from "@/lib/actions/knowHow";

const fields: FieldConfig[] = [
  { name: "sort_order", label: "순서", type: "number", width: "8%" },
  { name: "stage_name", label: "단계명", required: true },
  {
    name: "status",
    label: "상태",
    type: "select",
    options: [
      { value: "대기", label: "대기" },
      { value: "진행중", label: "진행중", color: "blue" },
      { value: "완료", label: "완료" },
    ],
  },
  { name: "planned_date", label: "예정일", type: "date", hideInTable: true },
  { name: "completed_date", label: "완료일", type: "date" },
  { name: "note", label: "메모", type: "textarea", hideInTable: true },
];

export async function ConstructionStageSection({ projectId }: { projectId?: string }) {
  const supabase = await createClient();
  const [{ data: projectTree }, { data: stages }, { data: knowHowNotes }] = await Promise.all([
    supabase.from("projects").select("id, name, year, site_id, sites(name, clients(name))").order("name"),
    projectId
      ? supabase
          .from("construction_stages")
          .select("*")
          .eq("project_id", projectId)
          .order("sort_order")
          .order("created_at")
      : Promise.resolve({ data: [] as { id: string; status: string }[] }),
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

  const stageRows = (stages ?? []) as { id: string; status: string }[];
  const completedCount = stageRows.filter((s) => s.status === "완료").length;
  const progressPct = stageRows.length ? Math.round((completedCount / stageRows.length) * 100) : 0;

  async function createBound(formData: FormData) {
    "use server";
    formData.set("project_id", projectId ?? "");
    return createConstructionStage(formData);
  }

  async function createKnowHowBound(formData: FormData) {
    "use server";
    formData.set("category", "construction");
    return createKnowHowNote(formData);
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">공사관리 — 설치 공정 단계별 진행 관리</h2>
        <ProjectTreeFilter basePath="/quality-construction" projects={projectNodes} selectedProjectId={projectId ?? ""} />
      </div>

      {!projectId ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          위에서 프로젝트를 선택하면 공정 단계를 볼 수 있어요.
        </p>
      ) : (
        <>
          {stageRows.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">
                  진행률 {completedCount}/{stageRows.length}단계 완료
                </span>
                <span className="font-mono font-semibold text-slate-900">{progressPct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${progressPct >= 100 ? "bg-red-500" : "bg-blue-500"}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          <CreatePanel title="공정 단계" fields={fields} createAction={createBound} />
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <EntityTable
              fields={fields}
              rows={stageRows as unknown as { id: string }[]}
              updateAction={updateConstructionStage}
              deleteAction={deleteConstructionStage}
            />
          </div>
        </>
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
