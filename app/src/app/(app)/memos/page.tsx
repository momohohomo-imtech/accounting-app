import { createClient } from "@/lib/supabase/server";
import { createMemoRecord, updateMemoRecord, deleteMemoRecord, moveMemoRecord } from "@/lib/actions/memos";
import { MemoCreateForm } from "@/components/MemoCreateForm";
import { MemoCard } from "@/components/MemoCard";
import { Pill } from "@/components/ui/Pill";
import { MEMO_CATEGORIES, MEMO_UNCATEGORIZED } from "@/lib/memoCategories";

export default async function MemosPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const supabase = await createClient();
  const [{ data: memos }, { error: categoryColumnError }] = await Promise.all([
    supabase.from("memos").select("*").order("sort_order").order("created_at", { ascending: false }),
    // 구분 칸(085 SQL)이 있는지 — 실행 전이면 구분 탭·선택칸 없이 예전처럼 보여준다.
    supabase.from("memos").select("category").limit(1),
  ]);
  const hasCategory = !categoryColumnError;
  const all = memos ?? [];

  const categoryOf = (m: { category?: string | null }) => m.category ?? MEMO_UNCATEGORIZED;
  const tabs = [...MEMO_CATEGORIES.map((c) => c.value as string), MEMO_UNCATEGORIZED];
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

      <div className="space-y-2">
        {visible.map((m, i) => (
          <MemoCard
            key={m.id}
            memo={m}
            isFirst={i === 0}
            isLast={i === visible.length - 1}
            hasCategory={hasCategory}
            moveScope={selected}
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
