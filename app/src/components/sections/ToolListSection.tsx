import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { CreatePanel } from "@/components/crud/CreatePanel";
import { EntityTable } from "@/components/crud/EntityTable";
import type { FieldConfig } from "@/components/crud/types";
import { createTool, updateTool, deleteTool } from "@/lib/actions/tools";
import { ToolChecklistCreateForm } from "@/components/ToolChecklistCreateForm";
import { ToolChecklistHistoryTable } from "@/components/ToolChecklistHistoryTable";
import { ToolChecklistDetailReport } from "@/components/ToolChecklistDetailReport";
import { KnowHowSection } from "@/components/KnowHowSection";
import { createKnowHowNote, updateKnowHowNote, deleteKnowHowNote } from "@/lib/actions/knowHow";

const toolFields: FieldConfig[] = [
  { name: "name", label: "공구명", required: true },
  { name: "category", label: "분류", placeholder: "예: 소공구, 대공구·장비, 아시바, 안전·기타" },
  { name: "note", label: "메모", hideInTable: true },
];

type ChecklistItemRow = {
  id: string;
  checklist_id: string;
  tool_id: string | null;
  tool_name: string;
  checked: boolean;
  quantity: number;
};

export async function ToolListSection({ copyFrom, checklist }: { copyFrom?: string; checklist?: string }) {
  const supabase = await createClient();
  const [{ data: tools }, { data: projects }, { data: checklists }, { data: items }, { data: knowHowNotes }] =
    await Promise.all([
      supabase.from("tools").select("*").order("name"),
      supabase.from("projects").select("id, name, year, sites(name)").order("year", { ascending: false }).order("name"),
      supabase.from("tool_checklists").select("*, projects(name)").order("created_at", { ascending: false }),
      supabase.from("tool_checklist_items").select("*"),
      supabase.from("know_how_notes").select("*").eq("category", "tools").order("created_at", { ascending: false }),
    ]);

  async function createKnowHowBound(formData: FormData) {
    "use server";
    formData.set("category", "tools");
    return createKnowHowNote(formData);
  }

  const itemsByChecklist = new Map<string, ChecklistItemRow[]>();
  for (const it of (items ?? []) as ChecklistItemRow[]) {
    const list = itemsByChecklist.get(it.checklist_id) ?? [];
    list.push(it);
    itemsByChecklist.set(it.checklist_id, list);
  }

  const historyRows = (checklists ?? []).map((c) => ({
    id: c.id as string,
    title: c.title as string,
    project_name: (one(c.projects) as { name: string } | null)?.name ?? null,
    trip_date: c.trip_date as string | null,
    item_count: (itemsByChecklist.get(c.id) ?? []).length,
    created_at: c.created_at as string,
  }));

  const projectOptions = (projects ?? []).map((p) => {
    const site = one(p.sites) as { name: string } | undefined;
    return { value: p.id as string, label: `${p.year} · ${site?.name ?? "미지정"} · ${p.name}` };
  });

  const toolOptions = (tools ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    category: (t.category as string | null) ?? null,
  }));

  const copySource = copyFrom ? (checklists ?? []).find((c) => c.id === copyFrom) : null;
  const copyItems = copyFrom ? itemsByChecklist.get(copyFrom) ?? [] : [];
  const initialQuantities = Object.fromEntries(
    copyItems.filter((i) => i.tool_id).map((i) => [i.tool_id as string, i.quantity || 1])
  );
  const initialTitle = copySource ? `${copySource.title} (복사)` : "";

  const detailChecklist = checklist ? (checklists ?? []).find((c) => c.id === checklist) : null;
  const detailItems = checklist ? (itemsByChecklist.get(checklist) ?? []).filter((i) => i.quantity > 0) : [];
  const popupOpen = Boolean(detailChecklist);

  return (
    <div className="space-y-6">
      <div className={popupOpen ? "space-y-6 print:hidden" : "space-y-6"}>
        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">공구 마스터 목록</h2>
          <CreatePanel title="공구" fields={toolFields} createAction={createTool} />
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <EntityTable fields={toolFields} rows={tools ?? []} updateAction={updateTool} deleteAction={deleteTool} />
          </div>
        </div>

        <ToolChecklistCreateForm
          key={copyFrom ?? "new"}
          tools={toolOptions}
          projectOptions={projectOptions}
          initialTitle={initialTitle}
          initialQuantities={initialQuantities}
        />

        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">저장된 공구명세서 (이력)</h2>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <ToolChecklistHistoryTable rows={historyRows} />
          </div>
        </div>

        <KnowHowSection
          title="공구리스트 노하우"
          notes={(knowHowNotes ?? []) as unknown as { id: string; title: string; content: string | null; memo: string | null; created_at: string }[]}
          createAction={createKnowHowBound}
          updateAction={updateKnowHowNote}
          deleteAction={deleteKnowHowNote}
        />
      </div>

      {detailChecklist && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10 print:static print:bg-transparent print:p-0">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl print:max-w-none print:rounded-none print:shadow-none">
            <ToolChecklistDetailReport
              title={detailChecklist.title}
              projectName={(one(detailChecklist.projects) as { name: string } | null)?.name ?? null}
              tripDate={detailChecklist.trip_date}
              items={detailItems}
              closeHref="/quality-construction?tab=tools"
              copyHref={`/quality-construction?tab=tools&copyFrom=${detailChecklist.id}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
