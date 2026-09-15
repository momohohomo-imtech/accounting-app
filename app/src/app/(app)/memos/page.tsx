import { createClient } from "@/lib/supabase/server";
import { createMemoRecord, updateMemoRecord, deleteMemoRecord, moveMemoRecord } from "@/lib/actions/memos";
import { MemoCreateForm } from "@/components/MemoCreateForm";
import { MemoCard } from "@/components/MemoCard";

export default async function MemosPage() {
  const supabase = await createClient();
  const { data: memos } = await supabase
    .from("memos")
    .select("*")
    .order("sort_order")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">메모장</h1>

      <MemoCreateForm createAction={createMemoRecord} />

      <div className="space-y-4">
        {(memos ?? []).map((m, i) => (
          <MemoCard
            key={m.id}
            memo={m}
            isFirst={i === 0}
            isLast={i === (memos?.length ?? 0) - 1}
            updateAction={updateMemoRecord}
            deleteAction={deleteMemoRecord}
            moveAction={moveMemoRecord}
          />
        ))}
        {(memos ?? []).length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">작성된 메모가 없습니다.</p>
        )}
      </div>
    </div>
  );
}
