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
  const [open, setOpen] = useState(false);

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

  // 평소엔 한 줄(제목·내용 첫 줄·날짜)만 보이고, 줄을 누르거나 ▸ 버튼을 누르면 내용과 수정/삭제가
  // 펼쳐진다. 인쇄할 때는 모두 펼쳐진 상태로 나온다.
  const preview = (memo.content ?? "").split("\n").find((l) => l.trim()) ?? "";
  const contentId = `memo-content-${memo.id}`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
        <div className="flex shrink-0 gap-1 print:hidden">
          <button
            type="button"
            disabled={isFirst}
            onClick={() => handleMove("up")}
            aria-label="위로"
            className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] leading-none text-slate-500 hover:bg-slate-100 disabled:opacity-30"
          >
            ▲
          </button>
          <button
            type="button"
            disabled={isLast}
            onClick={() => handleMove("down")}
            aria-label="아래로"
            className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] leading-none text-slate-500 hover:bg-slate-100 disabled:opacity-30"
          >
            ▼
          </button>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={contentId}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-0.5 text-left hover:bg-slate-50"
        >
          <span
            className={`shrink-0 text-xs text-slate-400 transition-transform print:hidden ${open ? "rotate-90" : ""}`}
            aria-hidden
          >
            ▶
          </span>
          <span className="min-w-0 shrink truncate font-semibold text-slate-900">{memo.title}</span>
          {!open && preview && (
            <span className="hidden min-w-0 flex-1 truncate text-sm text-slate-400 sm:block print:hidden">{preview}</span>
          )}
          <span className="ml-auto shrink-0 whitespace-nowrap text-xs text-slate-400">{formatDate(memo.created_at)}</span>
        </button>
      </div>

      <div id={contentId} className={`${open ? "" : "hidden print:block"} border-t border-slate-100 px-4 pb-4 pt-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-400">
            작성 {formatDate(memo.created_at)}
            {memo.updated_at !== memo.created_at && ` · 수정 ${formatDate(memo.updated_at)}`}
          </p>
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
        {memo.content ? (
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{memo.content}</p>
        ) : (
          <p className="mt-3 text-sm text-slate-400">내용 없음</p>
        )}
      </div>
    </div>
  );
}
