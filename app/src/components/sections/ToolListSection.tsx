import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { CreatePanel } from "@/components/crud/CreatePanel";
import type { FieldConfig } from "@/components/crud/types";
import { createTool } from "@/lib/actions/tools";
import { ToolMasterGrid } from "@/components/ToolMasterGrid";
import { ToolChecklistCreateForm } from "@/components/ToolChecklistCreateForm";
import { ToolChecklistHistoryTable } from "@/components/ToolChecklistHistoryTable";
import { ToolChecklistHistoryFilter } from "@/components/ToolChecklistHistoryFilter";
import { ToolChecklistDetailReport } from "@/components/ToolChecklistDetailReport";
import { KnowHowSection } from "@/components/KnowHowSection";
import { createKnowHowNote, updateKnowHowNote, deleteKnowHowNote } from "@/lib/actions/knowHow";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { groupToolsBySortOrder, toolGroupLabel } from "@/lib/tools";
import { fetchAllRows } from "@/lib/supabaseFetchAll";
import { nowKst } from "@/lib/kstDate";

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

// 공구명세서 이력 기본 표시 건수(최근 작성순).
const HISTORY_RECENT_COUNT = 15;

export async function ToolListSection({
  copyFrom,
  editFrom,
  checklist,
  historyYear,
  historyMonth,
  historySite,
}: {
  copyFrom?: string;
  editFrom?: string;
  checklist?: string;
  historyYear?: string;
  historyMonth?: string;
  historySite?: string;
}) {
  const supabase = await createClient();
  const [{ data: tools }, { data: sites }, { data: projects }, checklists, items, { data: knowHowNotes }] =
    await Promise.all([
      supabase.from("tools").select("*").order("sort_order").order("position").order("name"),
      supabase.from("sites").select("id, name, clients(name)").order("name"),
      supabase.from("projects").select("id, name, site_id, status, year, project_code").order("name"),
      fetchAllRows<{
        id: string;
        title: string;
        project_id: string | null;
        trip_date: string | null;
        helper_count: number | null;
        memo: string | null;
        created_at: string;
        projects: { name: string; site_id: string | null } | { name: string; site_id: string | null }[] | null;
      }>((from, to) =>
        supabase
          .from("tool_checklists")
          .select("*, projects(name, site_id)")
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to)
      ),
      fetchAllRows<ChecklistItemRow>((from, to) =>
        supabase.from("tool_checklist_items").select("*").order("id", { ascending: true }).range(from, to)
      ),
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
  for (const it of items) {
    const list = itemsByChecklist.get(it.checklist_id) ?? [];
    list.push(it);
    itemsByChecklist.set(it.checklist_id, list);
  }

  const historyRows = checklists.map((c) => {
    const project = one(c.projects) as { name: string; site_id: string | null } | null;
    return {
      id: c.id as string,
      title: c.title as string,
      project_name: project?.name ?? null,
      site_id: project?.site_id ?? null,
      trip_date: c.trip_date as string | null,
      item_count: (itemsByChecklist.get(c.id) ?? []).length,
      created_at: c.created_at as string,
    };
  });

  // 이력 목록 기본은 "최근 작성 15건"(저장일 최신순, 사용자 요청 — 예전엔 출장일 기준 이번 달만 보여서 다른 달
  // 출장으로 새로 쓴 명세서가 안 보였음). 연도를 고르면 출장일(trip_date) 기준 연/월 필터로 그 기간 전체를 보여주고,
  // 그때는 연/월을 URL에 남겨서 파라미터가 없는 기본(최근 15건)과 구분함. 현장 필터는 두 경우 모두 적용.
  const { year: currentYear } = nowKst();
  const selectedHistoryYear = historyYear ?? "recent";
  const selectedHistoryMonth = historyYear ? (historyMonth ?? "all") : "all";
  const selectedHistorySiteId = historySite ?? "all";

  const historyYears = Array.from(
    new Set(
      historyRows
        .filter((r) => r.trip_date)
        .map((r) => Number(r.trip_date!.slice(0, 4)))
        .concat(selectedHistoryYear === "all" || selectedHistoryYear === "recent" ? [] : [Number(selectedHistoryYear)])
    )
  ).sort((a, b) => b - a);

  const siteHistoryRows = historyRows.filter((r) => selectedHistorySiteId === "all" || r.site_id === selectedHistorySiteId);
  // historyRows는 저장일(created_at) 최신순으로 조회돼 있어서 앞에서 15건이 최근 작성분.
  const filteredHistoryRows =
    selectedHistoryYear === "recent"
      ? siteHistoryRows.slice(0, HISTORY_RECENT_COUNT)
      : siteHistoryRows.filter((r) => {
          const [tripYear, tripMonth] = r.trip_date
            ? [r.trip_date.slice(0, 4), String(Number(r.trip_date.slice(5, 7)))]
            : [null, null];
          const yearMatches = selectedHistoryYear === "all" || tripYear === selectedHistoryYear;
          const monthMatches = selectedHistoryMonth === "all" || tripMonth === selectedHistoryMonth;
          return yearMatches && monthMatches;
        });

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
    initialMemo,
  } = editSource
    ? {
        ...buildInitialFormState(itemsByChecklist.get(editSource.id) ?? []),
        initialTitle: editSource.title as string,
        initialProjectId: (editSource.project_id as string | null) ?? "",
        initialTripDate: (editSource.trip_date as string | null) ?? undefined,
        initialHelperCount: editSource.helper_count != null ? String(editSource.helper_count) : "",
        initialMemo: (editSource.memo as string | null) ?? "",
      }
    : copySource
      ? {
          ...buildInitialFormState(itemsByChecklist.get(copySource.id) ?? []),
          initialTitle: `${copySource.title} (복사)`,
          initialProjectId: "",
          initialTripDate: undefined as string | undefined,
          initialHelperCount: copySource.helper_count != null ? String(copySource.helper_count) : "",
          initialMemo: (copySource.memo as string | null) ?? "",
        }
      : {
          initialQuantities: {},
          initialToolNames: {},
          initialAdhocItems: [],
          initialTitle: "",
          initialProjectId: "",
          initialTripDate: undefined as string | undefined,
          initialHelperCount: "",
          initialMemo: "",
        };

  // "__blank__"는 실제 저장된 명세서가 아니라, 마스터 공구 전체를 빈 칸으로 인쇄해볼
  // 수 있게 하는 특수 값(아래 "폼 인쇄" 링크에서 씀).
  const isBlankForm = checklist === "__blank__";
  const detailChecklist = checklist && !isBlankForm ? (checklists ?? []).find((c) => c.id === checklist) : null;

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
  const popupOpen = Boolean(detailChecklist) || isBlankForm;

  return (
    <div className="space-y-6">
      <div className={popupOpen ? "space-y-6 print:hidden" : "space-y-6"}>
        {/* 네 칸(공구 마스터·새 명세서·이력·메모)을 모두 같은 카드 모양으로 — 예전엔 카드 없는 접힘 제목 2개와 카드 2개가
            섞여 있었음. 새 명세서 카드는 휴대폰에서 공구 칸 자리를 넓게 쓰도록 안쪽 여백을 줄임(명세서 폼 자체 카드는 없앰). */}
        <CollapsibleSection title="공구 마스터 목록">
          <CreatePanel title="공구" fields={toolFields} createAction={createTool} />
          <div className="mt-3">
            <ToolMasterGrid tools={toolMasterRows} />
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title={editSource ? "공구명세서 수정" : "새 공구명세서 만들기"}
          defaultOpen={Boolean(editSource || copySource)}
          className="max-md:p-3"
          headerExtra={
            <Link
              href="/quality-construction?tab=tools&checklist=__blank__"
              className="text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900 print:hidden"
            >
              폼 인쇄
            </Link>
          }
        >
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
            initialMemo={initialMemo}
            initialQuantities={initialQuantities}
            initialToolNames={initialToolNames}
            initialAdhocItems={initialAdhocItems}
            hasSource={Boolean(editSource || copySource)}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="저장된 공구명세서 (이력)"
          headerExtra={
            <ToolChecklistHistoryFilter
              basePath="/quality-construction"
              years={historyYears}
              selectedYear={selectedHistoryYear}
              selectedMonth={selectedHistoryMonth}
              sites={siteOptions}
              selectedSiteId={selectedHistorySiteId}
              currentYear={currentYear}
              recentCount={HISTORY_RECENT_COUNT}
            />
          }
        >
          {selectedHistoryYear === "recent" && siteHistoryRows.length > HISTORY_RECENT_COUNT && (
            <p className="mb-2 text-xs text-slate-400">
              최근 작성한 {HISTORY_RECENT_COUNT}건 (전체 {siteHistoryRows.length}건) · 이전 명세서는 연도·월을 골라서 보세요
            </p>
          )}
          <ToolChecklistHistoryTable rows={filteredHistoryRows} />
        </CollapsibleSection>

        <KnowHowSection
          title="공구 관련 메모"
          itemLabel="메모"
          notes={(knowHowNotes ?? []) as unknown as { id: string; title: string; content: string | null; memo: string | null; created_at: string }[]}
          createAction={createKnowHowBound}
          updateAction={updateKnowHowNote}
          deleteAction={deleteKnowHowNote}
        />
      </div>

      {(detailChecklist || isBlankForm) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-ink/50 p-4 py-10 print:static print:overflow-visible print:bg-transparent print:p-0">
          <div className="w-full max-w-[210mm] rounded-2xl bg-white p-6 shadow-xl print:max-w-none print:rounded-none print:p-0 print:shadow-none">
            <ToolChecklistDetailReport
              title={detailChecklist ? detailChecklist.title : "공구명세서 양식"}
              helperCount={detailChecklist ? (detailChecklist.helper_count ?? null) : null}
              projectName={detailChecklist ? ((one(detailChecklist.projects) as { name: string } | null)?.name ?? null) : null}
              tripDate={detailChecklist ? detailChecklist.trip_date : null}
              memo={detailChecklist ? ((detailChecklist.memo as string | null) ?? null) : null}
              groups={detailGroups}
              closeHref="/quality-construction?tab=tools"
              copyHref={detailChecklist ? `/quality-construction?tab=tools&copyFrom=${detailChecklist.id}` : "/quality-construction?tab=tools"}
              editHref={detailChecklist ? `/quality-construction?tab=tools&editFrom=${detailChecklist.id}` : "/quality-construction?tab=tools"}
              hideEditActions={isBlankForm}
            />
          </div>
        </div>
      )}
    </div>
  );
}
