import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { CreatePanel } from "@/components/crud/CreatePanel";
import { EntityTable } from "@/components/crud/EntityTable";
import { ProjectTreeFilter, type ProjectTreeNode } from "@/components/ProjectTreeFilter";
import type { FieldConfig } from "@/components/crud/types";
import {
  createQualityChecklistItem,
  updateQualityChecklistItem,
  deleteQualityChecklistItem,
} from "@/lib/actions/qualityChecklist";
import { KnowHowSection } from "@/components/KnowHowSection";
import { createKnowHowNote, updateKnowHowNote, deleteKnowHowNote } from "@/lib/actions/knowHow";

const fields: FieldConfig[] = [
  { name: "process_name", label: "공정/공사명", required: true },
  { name: "item_name", label: "점검 항목", required: true },
  {
    name: "result",
    label: "결과",
    type: "select",
    options: [
      { value: "보류", label: "보류" },
      { value: "합격", label: "합격", color: "blue" },
      { value: "불합격", label: "불합격", color: "red" },
    ],
  },
  { name: "check_date", label: "점검일", type: "date" },
  { name: "note", label: "메모", type: "textarea", hideInTable: true },
];

export async function QualityChecklistSection({ projectId }: { projectId?: string }) {
  const supabase = await createClient();
  const [{ data: projectTree }, { data: items }, { data: knowHowNotes }] = await Promise.all([
    supabase.from("projects").select("id, name, year, site_id, sites(name, clients(name))").order("name"),
    projectId
      ? supabase
          .from("quality_checklist_items")
          .select("*")
          .eq("project_id", projectId)
          .order("process_name")
          .order("created_at")
      : Promise.resolve({ data: [] as { id: string }[] }),
    supabase.from("know_how_notes").select("*").eq("category", "quality").order("created_at", { ascending: false }),
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

  async function createBound(formData: FormData) {
    "use server";
    formData.set("project_id", projectId ?? "");
    return createQualityChecklistItem(formData);
  }

  async function createKnowHowBound(formData: FormData) {
    "use server";
    formData.set("category", "quality");
    return createKnowHowNote(formData);
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">품질관리 — 공정/공사별 하자보수관리 및 이력</h2>
        <ProjectTreeFilter basePath="/quality-construction" projects={projectNodes} selectedProjectId={projectId ?? ""} />
      </div>

      {!projectId ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          위에서 프로젝트를 선택하면 품질 체크리스트를 볼 수 있어요.
        </p>
      ) : (
        <>
          <CreatePanel title="점검 항목" fields={fields} createAction={createBound} />
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <EntityTable
              fields={fields}
              rows={(items ?? []) as unknown as { id: string }[]}
              updateAction={updateQualityChecklistItem}
              deleteAction={deleteQualityChecklistItem}
            />
          </div>
        </>
      )}

      <KnowHowSection
        title="품질관리 노하우"
        notes={(knowHowNotes ?? []) as unknown as { id: string; title: string; content: string | null; memo: string | null; created_at: string }[]}
        createAction={createKnowHowBound}
        updateAction={updateKnowHowNote}
        deleteAction={deleteKnowHowNote}
      />
    </div>
  );
}
