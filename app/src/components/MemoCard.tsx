"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format";
import { fieldClass, labelClass } from "@/components/ui/field";
import { Button } from "@/components/ui/Button";

type Memo = { id: string; title: string; content: string | null; created_at: string; updated_at: string };

export function MemoCard({
  memo,
  updateAction,
  deleteAction,
}: {
  memo: Memo;
  updateAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (editing) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <form
          action={(fd) => {
            updateAction(fd);
            setEditing(false);
          }}
          className="space-y-3"
        >
          <input type="hidden" name="id" value={memo.id} />
          <div className="flex flex-col gap-1">
            <label className={labelClass}>제목</label>
            <input name="title" defaultValue={memo.title} required className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>내용</label>
            <textarea name="content" defaultValue={memo.content ?? ""} rows={5} className={fieldClass} />
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm">
              저장
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(false)}>
              취소
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900">{memo.title}</h3>
          <p className="mt-1 text-xs text-slate-400">
            {formatDate(memo.created_at)}
            {memo.updated_at !== memo.created_at && ` (수정 ${formatDate(memo.updated_at)})`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {confirmingDelete ? (
            <form action={deleteAction} className="flex items-center gap-1">
              <input type="hidden" name="id" value={memo.id} />
              <span className="text-xs font-medium text-red-600">정말 삭제?</span>
              <Button type="submit" variant="danger" size="xs">
                확인
              </Button>
              <Button type="button" variant="secondary" size="xs" onClick={() => setConfirmingDelete(false)}>
                취소
              </Button>
            </form>
          ) : (
            <>
              <Button type="button" variant="secondary" size="xs" onClick={() => setEditing(true)}>
                수정
              </Button>
              <Button type="button" variant="danger" size="xs" onClick={() => setConfirmingDelete(true)}>
                삭제
              </Button>
            </>
          )}
        </div>
      </div>
      {memo.content && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{memo.content}</p>}
    </div>
  );
}
