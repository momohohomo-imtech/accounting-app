"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resolveCategoryColor } from "@/lib/categoryColor";
import { updateExpenseCategoryColor } from "@/lib/actions/expense-categories";
import { Button } from "@/components/ui/Button";

type CategoryWithColor = { id: string; name: string; color: string | null; project_only: boolean };

function CategoryRow({ category }: { category: CategoryWithColor }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(resolveCategoryColor(category) ?? "#64748b");
  const [pending, setPending] = useState(false);

  async function save(color: string | null) {
    setPending(true);
    const fd = new FormData();
    fd.append("id", category.id);
    fd.append("color", color ?? "");
    await updateExpenseCategoryColor(fd);
    setPending(false);
    setEditing(false);
    router.refresh();
  }

  const resolved = resolveCategoryColor(category);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
      <span
        className="h-5 w-5 shrink-0 rounded-full border border-slate-200"
        style={{ backgroundColor: resolved ?? "#e2e8f0" }}
      />
      <span className="flex-1 truncate text-sm" style={{ color: resolved }}>
        {category.name}
      </span>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-7 w-9 cursor-pointer rounded border border-slate-300 p-0.5"
          />
          <Button type="button" size="xs" disabled={pending} onClick={() => save(draft)}>
            저장
          </Button>
          {category.color && (
            <Button type="button" variant="secondary" size="xs" disabled={pending} onClick={() => save(null)}>
              색 지우기
            </Button>
          )}
          <Button type="button" variant="secondary" size="xs" disabled={pending} onClick={() => setEditing(false)}>
            취소
          </Button>
        </div>
      ) : (
        <Button type="button" variant="secondary" size="xs" onClick={() => setEditing(true)}>
          색 지정
        </Button>
      )}
    </div>
  );
}

export function CategoryColorLegend({ categories }: { categories: CategoryWithColor[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
      <h2 className="mb-1 font-semibold text-slate-900">카테고리 색상</h2>
      <p className="mb-3 text-xs text-slate-400">
        여기서 지정한 색이 매입매출 목록, 프로젝트 손익보고서 등 카테고리 이름이 나오는 곳마다 그대로
        적용돼요. 색을 지정 안 하면 기존처럼 프로젝트 전용 카테고리만 빨간색으로 표시돼요.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <CategoryRow key={c.id} category={c} />
        ))}
        {categories.length === 0 && <p className="text-sm text-slate-400">등록된 카테고리가 없습니다.</p>}
      </div>
    </div>
  );
}
