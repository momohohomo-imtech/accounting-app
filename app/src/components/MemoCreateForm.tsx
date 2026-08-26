"use client";

import { useState } from "react";
import { fieldClass, labelClass } from "@/components/ui/field";
import { Button } from "@/components/ui/Button";

export function MemoCreateForm({ createAction }: { createAction: (formData: FormData) => void }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return <Button onClick={() => setOpen(true)}>+ 메모작성</Button>;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <form
        action={(fd) => {
          createAction(fd);
          setOpen(false);
        }}
        className="space-y-3"
      >
        <div className="flex flex-col gap-1">
          <label className={labelClass}>제목</label>
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
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
