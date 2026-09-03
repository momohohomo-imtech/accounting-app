import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { CreatePanel } from "@/components/crud/CreatePanel";
import type { FieldConfig } from "@/components/crud/types";
import { createTool } from "@/lib/actions/tools";
import { ToolMasterGrid } from "@/components/ToolMasterGrid";
import { ToolChecklistCreateForm } from "@/components/ToolChecklistCreateForm";
import { ToolChecklistHistoryTable } from "@/components/ToolChecklistHistoryTable";
import { ToolChecklistDetailReport } from "@/components/ToolChecklistDetailReport";
import { KnowHowSection } from "@/components/KnowHowSection";
import { createKnowHowNote, updateKnowHowNote, deleteKnowHowNote } from "@/lib/actions/knowHow";
import { CollapsibleSection } from "@/components/CollapsibleSection";

const toolFields: FieldConfig[] = [
  { name: "name", label: "공구명", required: true },
  { name: "sort_order", label: "순번", type: "number" },
  { name: "note", label: "메모", hideInTable: true },
];

type ChecklistItemRow = {
  id: string;
  checklist_id: string;
  tool_id: string | null;
  tool_name: string;
  checked: boolean;
  quantity: string;
  for_access_pass: boolean;
};

function buildInitialFormState(items: ChecklistItemRow[]) {
  const initialQuantities: Record<string, string> = {};
  const initialAdhocItems: { name: string; quantity: string; forAccessPass: boolean }[] = [];
  for (const i of items) {
    const qty = String(i.quantity ?? "").trim();
    if (!qty) continue;
    if (i.tool_id) initialQuantities[i.tool_id] = qty;
    else initialAdhocItems.push({ name: i.tool_name, quantity: qty, forAccessPass: Boolean(i.for_access_pass) });
  }
  return { initialQuantities, initialAdhocItems };
}

export async function ToolListSection({
  copyFrom,
  editFrom,
  checklist,
}: {
  copyFrom?: string;
  editFrom?: string;
  checklist?: string;
}) {
  const supabase = await createClient();
  const [{ data: tools }, { data: sites }, { data: projects }, { data: checklists }, { data: items }, { data: knowHowNotes }] =
    await Promise.all([
      supabase.from("tools").select("*").order("sort_order").order("position").order("name"),
      supabase.from("sites").select("id, name, clients(name)").order("name"),
      supabase.from("projects").select("id, name, site_id, status, year, project_code").order("name"),
      supabase.from("tool_checklists").select("*, projects(name)").order("created_at", { ascending: false }),
      supabase.from("tool_checklist_items").select("*"),
      supabase.from("know_how_notes").select("*").eq("category", "tools").order("created_at", { ascending: false }),
    ]);

  const siteOptions = (sites ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    client_name: (one(s.clients) as { name: string } | undefined)?.name ?? null,
  }));

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

  const toolOptions = (tools ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    sort_order: (t.sort_order as number | null) ?? 0,
    linked_tool_ids: (t.linked_tool_ids as string[] | null) ?? [],
    text_color: (t.text_color as string | null) ?? null,
    background_color: (t.background_color as string | null) ?? null,
    default_quantity: (t.default_quantity as string | null) ?? null,
    for_access_pass: Boolean(t.for_access_pass),
  }));

  const toolMasterRows = (tools ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    sort_order: (t.sort_order as number | null) ?? 0,
    note: (t.note as string | null) ?? null,
    linked_tool_ids: (t.linked_tool_ids as string[] | null) ?? [],
    text_color: (t.text_color as string | null) ?? null,
    background_color: (t.background_color as string | null) ?? null,
    default_quantity: (t.default_quantity as string | null) ?? null,
    for_access_pass: Boolean(t.for_access_pass),
  }));

  const copySource = copyFrom ? (checklists ?? []).find((c) => c.id === copyFrom) : null;
  const editSource = editFrom ? (checklists ?? []).find((c) => c.id === editFrom) : null;

  const { initialQuantities, initialAdhocItems, initialTitle, initialProjectId, initialTripDate } = editSource
    ? {
        ...buildInitialFormState(itemsByChecklist.get(editSource.id) ?? []),
        initialTitle: editSource.title as string,
        initialProjectId: (editSource.project_id as string | null) ?? "",
        initialTripDate: (editSource.trip_date as string | null) ?? undefined,
      }
    : copySource
      ? {
          ...buildInitialFormState(itemsByChecklist.get(copySource.id) ?? []),
          initialTitle: `${copySource.title} (복사)`,
          initialProjectId: "",
          initialTripDate: undefined as string | undefined,
        }
      : {
          initialQuantities: {},
          initialAdhocItems: [],
          initialTitle: "",
          initialProjectId: "",
          initialTripDate: undefined as string | undefined,
        };

  const detailChecklist = checklist ? (checklists ?? []).find((c) => c.id === checklist) : null;
  const detailItems = checklist
    ? (itemsByChecklist.get(checklist) ?? []).filter((i) => String(i.quantity ?? "").trim() !== "")
    : [];
  const popupOpen = Boolean(detailChecklist);

  return (
    <div className="space-y-6">
      <div className={popupOpen ? "space-y-6 print:hidden" : "space-y-6"}>
        <CollapsibleSection title="공구 마스터 목록" bare>
          <CreatePanel title="공구" fields={toolFields} createAction={createTool} />
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <ToolMasterGrid tools={toolMasterRows} />
          </div>
        </CollapsibleSection>

        <ToolChecklistCreateForm
          key={editFrom ?? copyFrom ?? "new"}
          tools={toolOptions}
          sites={siteOptions}
          projects={projects ?? []}
          checklistId={editSource?.id as string | undefined}
          initialTitle={initialTitle}
          initialProjectId={initialProjectId}
          initialTripDate={initialTripDate}
          initialQuantities={initialQuantities}
          initialAdhocItems={initialAdhocItems}
        />

        <CollapsibleSection title="저장된 공구명세서 (이력)">
          <ToolChecklistHistoryTable rows={historyRows} />
        </CollapsibleSection>

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
              editHref={`/quality-construction?tab=tools&editFrom=${detailChecklist.id}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
