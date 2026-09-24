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
  createAction: (formData: FormData) => void;
  hasCategory: boolean;
  defaultCategory?: string;
}) {
  const [open, setOpen] = useState(false);
  const pending = useGlobalPending();

  if (!open) {
    return <Button onClick={() => setOpen(true)}>+ 메모작성</Button>;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <form
        action={async (fd) => {
          await pending.run(() => Promise.resolve(createAction(fd)));
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
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm">
            저장
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
            취소
          </Button>
        </div>
      </form>
    </div>
  );
}
