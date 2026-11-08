import { createClient } from "@/lib/supabase/server";
import { createMemoRecord, updateMemoRecord, deleteMemoRecord, moveMemoRecord } from "@/lib/actions/memos";
import { createMemoCategoryRecord, updateMemoCategoryRecord, deleteMemoCategoryRecord } from "@/lib/actions/memoCategories";
import { MemoCreateForm } from "@/components/MemoCreateForm";
import { MemoCard } from "@/components/MemoCard";
import { Pill } from "@/components/ui/Pill";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { CreatePanel } from "@/components/crud/CreatePanel";
import { EntityTable } from "@/components/crud/EntityTable";
import type { FieldConfig } from "@/components/crud/types";
import { MEMO_CATEGORY_COLORS, MEMO_CATEGORY_MAX_LENGTH, MEMO_UNCATEGORIZED, memoCategoryTabs } from "@/lib/memoCategories";
import { loadMemoCategories } from "@/lib/memoCategoryLoad";
import { fetchAllData } from "@/lib/supabaseFetchAll";

// 구분 관리(104 SQL, 11/8 사용자 요청) — 지출카테고리처럼 추가 칸 + 정렬되는 표(수정·삭제). 메모 수는 보기만.
const categoryFields: FieldConfig[] = [
  {
    name: "name",
    label: "구분 이름",
    required: true,
    placeholder: `예: 장비, 교육 (${MEMO_CATEGORY_MAX_LENGTH}자까지)`,
    dotColorField: "color",
  },
  { name: "color", label: "색", type: "select", options: MEMO_CATEGORY_COLORS.map((c) => ({ value: c.value, label: c.label })) },
  { name: "sort_order", label: "순서", type: "number", placeholder: "비우면 맨 뒤" },
  { name: "memo_count", label: "메모 수", readOnly: true, hideInCreate: true },
];

export default async function MemosPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const supabase = await createClient();
  const [{ data: memos }, { error: categoryColumnError }, categoryLoad] = await Promise.all([
    fetchAllData((from, to) =>
      supabase
        .from("memos")
        .select("*")
        .order("sort_order")
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to)
    ),
    // 구분 칸(085 SQL)이 있는지 — 실행 전이면 구분 탭·선택칸 없이 예전처럼 보여준다.
    supabase.from("memos").select("category").limit(1),
    // 구분 목록(104 SQL) — 실행 전이면 예전 고정 5개
    loadMemoCategories(supabase),
  ]);
  const hasCategory = !categoryColumnError;
  const all = memos ?? [];

  const { categories, ready: categoriesReady, error: categoriesError } = categoryLoad;
  const categoryOf = (m: { category?: string | null }) => m.category ?? MEMO_UNCATEGORIZED;
  // 구분 목록 순서 → 목록에 없는데 메모에 남은 구분(예전 백업 복원 등 — 메모가 숨지 않게) → 미분류
  const tabs = memoCategoryTabs(categories, all.map((m) => (m.category as string | null) ?? null));
  const countOf = (value: string) => all.filter((m) => categoryOf(m) === value).length;
  const selected = hasCategory && category && tabs.includes(category) ? category : null;
  const visible = selected ? all.filter((m) => categoryOf(m) === selected) : all;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">메모장</h1>

      <MemoCreateForm
        createAction={createMemoRecord}
        hasCategory={hasCategory}
        defaultCategory={selected && selected !== MEMO_UNCATEGORIZED ? selected : undefined}
        categoryNames={categories.map((c) => c.name)}
      />

      {hasCategory && (
        <div className="flex flex-wrap gap-2 print:hidden">
          <Pill href="/memos" active={!selected}>
            전체 <span className="ml-0.5 tabular-nums opacity-70">{all.length}</span>
          </Pill>
          {tabs
            // 미분류는 해당 메모가 있을 때만 탭으로 보여준다.
            .filter((t) => t !== MEMO_UNCATEGORIZED || countOf(t) > 0)
            .map((t) => (
              <Pill key={t} href={`/memos?category=${encodeURIComponent(t)}`} active={selected === t}>
                {t} <span className="ml-0.5 tabular-nums opacity-70">{countOf(t)}</span>
              </Pill>
            ))}
        </div>
      )}

      {hasCategory && categoriesError && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 print:hidden">
          구분 목록을 불러오지 못해 기본 구분으로 보여 드립니다 — 새로 고침해 주세요. ({categoriesError})
        </p>
      )}
      {hasCategory && categoriesReady && (
        <CollapsibleSection title="구분 관리" className="print:hidden">
          <p className="mb-3 text-xs text-slate-500">
            구분을 추가하거나 이름·색·순서를 바꿉니다. 이름을 바꾸면 그 구분의 메모도 함께 바뀌고, 메모가 남아 있는 구분은 지울 수
            없습니다(메모를 다른 구분으로 옮긴 뒤 삭제).
          </p>
          <CreatePanel title="구분" fields={categoryFields} createAction={createMemoCategoryRecord} />
          <div className="mt-3">
            <EntityTable
              fields={categoryFields}
              rows={categories.map((c) => ({ ...c, id: c.id as string, memo_count: countOf(c.name) }))}
              updateAction={updateMemoCategoryRecord}
              deleteAction={deleteMemoCategoryRecord}
            />
          </div>
        </CollapsibleSection>
      )}

      <div className="space-y-2">
        {visible.map((m, i) => (
          <MemoCard
            key={m.id}
            memo={m}
            isFirst={i === 0}
            isLast={i === visible.length - 1}
            hasCategory={hasCategory}
            moveScope={selected}
            categories={categories}
            updateAction={updateMemoRecord}
            deleteAction={deleteMemoRecord}
            moveAction={moveMemoRecord}
          />
        ))}
        {visible.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">
            {selected ? `'${selected}' 메모가 없습니다.` : "작성된 메모가 없습니다."}
          </p>
        )}
      </div>
    </div>
  );
}
