"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format";
import { fieldClass, labelClass } from "@/components/ui/field";
import { Button } from "@/components/ui/Button";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

type Memo = { id: string; title: string; content: string | null; created_at: string; updated_at: string };

export function MemoCard({
  memo,
  isFirst,
  isLast,
  updateAction,
  deleteAction,
  moveAction,
}: {
  memo: Memo;
  isFirst: boolean;
  isLast: boolean;
  updateAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
  moveAction: (formData: FormData) => void;
}) {
  const pending = useGlobalPending();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleMove(direction: "up" | "down") {
    const fd = new FormData();
    fd.append("id", memo.id);
    fd.append("direction", direction);
    await pending.run(() => Promise.resolve(moveAction(fd)));
  }

  async function handleDelete() {
    const fd = new FormData();
    fd.append("id", memo.id);
    await pending.run(() => Promise.resolve(deleteAction(fd)));
  }

  if (editing) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            await pending.run(() => Promise.resolve(updateAction(fd)));
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
    <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex shrink-0 flex-col gap-1 pt-0.5 print:hidden">
        <button
          type="button"
          disabled={isFirst}
          onClick={() => handleMove("up")}
          className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] leading-none text-slate-500 hover:bg-slate-100 disabled:opacity-30"
        >
          ▲
        </button>
        <button
          type="button"
          disabled={isLast}
          onClick={() => handleMove("down")}
          className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] leading-none text-slate-500 hover:bg-slate-100 disabled:opacity-30"
        >
          ▼
        </button>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900">{memo.title}</h3>
            <p className="mt-1 text-xs text-slate-400">
              {formatDate(memo.created_at)}
              {memo.updated_at !== memo.created_at && ` (수정 ${formatDate(memo.updated_at)})`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 print:hidden">
            {confirmingDelete ? (
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-red-600">정말 삭제?</span>
                <Button type="button" variant="danger" size="xs" onClick={handleDelete}>
                  확인
                </Button>
                <Button type="button" variant="secondary" size="xs" onClick={() => setConfirmingDelete(false)}>
                  취소
                </Button>
              </div>
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
    </div>
  );
}
