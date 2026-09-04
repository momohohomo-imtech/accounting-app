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
import { groupToolsBySortOrder, toolGroupLabel } from "@/lib/tools";

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
  // 마스터 공구를 이 명세서에서만 다르게 부른 이름(있으면) — 수정 화면을 다시 열 때
  // 저장된 이름을 그대로 복원해서, 재저장 시 마스터 이름으로 되돌아가 버리지 않게 함.
  const initialToolNames: Record<string, string> = {};
  const initialAdhocItems: { name: string; quantity: string; forAccessPass: boolean }[] = [];
  for (const i of items) {
    const qty = String(i.quantity ?? "").trim();
    if (!qty) continue;
    if (i.tool_id) {
      initialQuantities[i.tool_id] = qty;
      initialToolNames[i.tool_id] = i.tool_name;
    } else {
      initialAdhocItems.push({ name: i.tool_name, quantity: qty, forAccessPass: Boolean(i.for_access_pass) });
    }
  }
  return { initialQuantities, initialToolNames, initialAdhocItems };
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

  const {
    initialQuantities,
    initialToolNames,
    initialAdhocItems,
    initialTitle,
    initialProjectId,
    initialTripDate,
    initialHelperCount,
  } = editSource
    ? {
        ...buildInitialFormState(itemsByChecklist.get(editSource.id) ?? []),
        initialTitle: editSource.title as string,
        initialProjectId: (editSource.project_id as string | null) ?? "",
        initialTripDate: (editSource.trip_date as string | null) ?? undefined,
        initialHelperCount: editSource.helper_count != null ? String(editSource.helper_count) : "",
      }
    : copySource
      ? {
          ...buildInitialFormState(itemsByChecklist.get(copySource.id) ?? []),
          initialTitle: `${copySource.title} (복사)`,
          initialProjectId: "",
          initialTripDate: undefined as string | undefined,
          initialHelperCount: copySource.helper_count != null ? String(copySource.helper_count) : "",
        }
      : {
          initialQuantities: {},
          initialToolNames: {},
          initialAdhocItems: [],
          initialTitle: "",
          initialProjectId: "",
          initialTripDate: undefined as string | undefined,
          initialHelperCount: "",
        };

  const detailChecklist = checklist ? (checklists ?? []).find((c) => c.id === checklist) : null;

  // 인쇄/엑셀용 상세 목록은 (선택된 품목만이 아니라) 마스터 공구 전체를 순번별로
  // 보여주되, 이 명세서에 실제 담긴 품목만 수량을 채워서 표시함(나머지는 빈칸/회색).
  // 반입반출증 여부는 명세서 저장 시점 스냅샷(체크리스트 항목)이 있으면 그걸 쓰고,
  // 없으면(= 이 명세서에 안 담긴 공구) 공구 마스터의 현재 값을 씀.
  const detailGroups = (() => {
    if (!checklist) return [];
    const checklistItems = itemsByChecklist.get(checklist) ?? [];
    const itemByTool = new Map<string, ChecklistItemRow>();
    for (const it of checklistItems) if (it.tool_id) itemByTool.set(it.tool_id, it);

    const groups = groupToolsBySortOrder(toolMasterRows).map(([sortOrder, groupTools]) => ({
      label: toolGroupLabel(sortOrder),
      items: groupTools.map((t) => {
        const item = itemByTool.get(t.id);
        return {
          id: t.id,
          tool_name: item ? item.tool_name : t.name,
          quantity: item ? item.quantity : "",
          for_access_pass: item ? item.for_access_pass : t.for_access_pass,
        };
      }),
    }));

    const adhoc = checklistItems.filter((it) => !it.tool_id);
    if (adhoc.length > 0) {
      groups.push({
        label: "임의 추가",
        items: adhoc.map((it) => ({
          id: it.id,
          tool_name: it.tool_name,
          quantity: it.quantity,
          for_access_pass: it.for_access_pass,
        })),
      });
    }
    return groups;
  })();
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
          initialHelperCount={initialHelperCount}
          initialQuantities={initialQuantities}
          initialToolNames={initialToolNames}
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
              helperCount={detailChecklist.helper_count ?? null}
              projectName={(one(detailChecklist.projects) as { name: string } | null)?.name ?? null}
              tripDate={detailChecklist.trip_date}
              groups={detailGroups}
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
