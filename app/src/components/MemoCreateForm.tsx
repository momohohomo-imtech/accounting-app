"use client";

import { useState } from "react";
import { fieldClass, labelClass } from "@/components/ui/field";
import { Button } from "@/components/ui/Button";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { MemoCategorySelect } from "@/components/MemoCategorySelect";

export function MemoCreateForm({
  createAction,
  hasCategory,
  defaultCategory,
}: {
  createAction: (formData: FormData) => unknown;
  hasCategory: boolean;
  defaultCategory?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useGlobalPending();

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>+ 메모 추가</Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* onSubmit(form action 아님) — 저장이 실패해도 입력한 글이 지워지지 않게 */}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const result = await pending.run(() => Promise.resolve(createAction(fd)));
          if (result && typeof result === "object" && "error" in result && result.error) {
            setError(`저장하지 못했습니다: ${String(result.error)}`);
            return;
          }
          setError(null);
          setOpen(false);
        }}
        className="space-y-3"
      >
        {hasCategory && <MemoCategorySelect defaultValue={defaultCategory} />}
        <div className="flex flex-col gap-1">
          <label className={labelClass}>제목</label>
          <input name="title" required autoFocus className={fieldClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>내용</label>
          <textarea name="content" rows={5} className={fieldClass} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm">
            저장
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
          >
            취소
          </Button>
        </div>
      </form>
    </div>
  );
}
