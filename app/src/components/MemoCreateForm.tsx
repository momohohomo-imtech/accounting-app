"use client";

import { useRef, useState } from "react";
import { fieldClass, labelClass } from "@/components/ui/field";
import { Button } from "@/components/ui/Button";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { useUnsavedGuard } from "@/components/UnsavedChangesProvider";
import { MemoCategorySelect } from "@/components/MemoCategorySelect";

/** 폼에 지금 적힌 제목·내용(구분은 글을 쓴 게 아니라 안 셈) */
function readDraft(form: HTMLFormElement | null) {
  if (!form) return { title: "", content: "" };
  const fd = new FormData(form);
  return { title: String(fd.get("title") ?? ""), content: String(fd.get("content") ?? "") };
}

export function MemoCreateForm({
  createAction,
  hasCategory,
  defaultCategory,
  categoryNames,
}: {
  createAction: (formData: FormData) => unknown;
  hasCategory: boolean;
  defaultCategory?: string;
  /** 구분 고르기 목록(구분 목록 순서) */
  categoryNames: string[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", content: "" });
  const formRef = useRef<HTMLFormElement>(null);
  const pending = useGlobalPending();

  function reset() {
    setOpen(false);
    setError(null);
    setDraft({ title: "", content: "" });
  }

  // 저장됐으면 true — 실패하면 폼에 이유를 보여 주고 입력한 글은 그대로
  async function persist(fd: FormData): Promise<boolean> {
    if (!String(fd.get("title") ?? "").trim()) {
      setError("제목을 입력해야 저장할 수 있습니다.");
      formRef.current?.querySelector<HTMLInputElement>('input[name="title"]')?.focus();
      return false;
    }
    const result = await pending.run(() => Promise.resolve(createAction(fd)));
    if (result && typeof result === "object" && "error" in result && result.error) {
      setError(`저장하지 못했습니다: ${String(result.error)}`);
      return false;
    }
    reset();
    return true;
  }

  // 작성 중에 취소·화면 이동·뒤로가기를 하면 저장할지 물어봄(사용자 요청 11/19)
  const leave = useUnsavedGuard({
    dirty: open && Boolean(draft.title.trim() || draft.content.trim()),
    value: `${draft.title}\n${draft.content}`,
    label: "새 메모",
    save: () => (formRef.current ? persist(new FormData(formRef.current)) : Promise.resolve(true)),
    discard: reset,
  });

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
        ref={formRef}
        onChange={(e) => setDraft(readDraft(e.currentTarget))}
        onSubmit={async (e) => {
          e.preventDefault();
          await persist(new FormData(e.currentTarget));
        }}
        className="space-y-3"
      >
        {hasCategory && <MemoCategorySelect defaultValue={defaultCategory} categoryNames={categoryNames} />}
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
            onClick={async () => {
              if (await leave()) reset();
            }}
          >
            취소
          </Button>
        </div>
      </form>
    </div>
  );
}
