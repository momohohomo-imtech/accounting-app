"use client";

import { useState, useTransition } from "react";
import { updateProjectMemo } from "@/lib/actions/projects";
import { Button } from "@/components/ui/Button";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { useUnsavedGuard } from "@/components/UnsavedChangesProvider";

// 프로젝트 요약 카드 안에서 바로 메모를 쓰고 저장할 수 있게 — projects.memo를 그대로 씀
// (프로젝트 수정 팝업의 메모와 같은 필드). 내용이 있을 때만 인쇄에도 나온다.
// 저장하지 않고 화면을 떠나면(링크·뒤로가기) 저장할지 물어봄(useUnsavedGuard, 사용자 요청 11/19).
export function ProjectSummaryMemoEditor({
  projectId,
  initialMemo,
  label,
}: {
  projectId: string;
  initialMemo: string | null;
  /** 저장 확인창에 보일 이름(프로젝트 번호·이름) */
  label: string;
}) {
  const [memo, setMemo] = useState(initialMemo ?? "");
  const [savedMemo, setSavedMemo] = useState(initialMemo ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const globalPending = useGlobalPending();
  const dirty = memo !== savedMemo;
  const hasMemo = memo.trim().length > 0;

  // 저장됐으면 true — 실패하면 이유를 보여 주고 false
  async function persist(): Promise<boolean> {
    if (memo === savedMemo) return true;
    const fd = new FormData();
    fd.set("id", projectId);
    fd.set("memo", memo);
    const result = await globalPending.run(() => updateProjectMemo(fd));
    if (result?.error) {
      setError(`저장하지 못했습니다: ${result.error}`);
      return false;
    }
    setError(null);
    setSavedMemo(memo);
    return true;
  }

  useUnsavedGuard({ dirty, value: memo, label, save: persist, discard: () => setMemo(savedMemo) });

  function save() {
    if (!dirty) return;
    startTransition(async () => {
      await persist();
    });
  }

  return (
    <div
      className={`mt-4 rounded-xl border border-slate-200 px-4 py-3 print:mt-3 print:rounded-none print:border print:border-slate-400 print:break-inside-avoid ${
        hasMemo ? "" : "print:hidden"
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-2 print:hidden">
        <p className="text-xs font-medium text-slate-500">메모</p>
        <Button type="button" variant="secondary" size="xs" onClick={save} disabled={isPending || !dirty}>
          {isPending ? "저장 중..." : "저장"}
        </Button>
      </div>
      <p className="mb-1 hidden text-xs font-medium text-slate-500 print:block print:text-[9px]">메모</p>
      <textarea
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        rows={3}
        placeholder="이 프로젝트에 대한 메모를 남겨주세요"
        className="w-full resize-y rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700 print:hidden"
      />
      {error && <p className="text-sm text-red-600 print:hidden">{error}</p>}
      {hasMemo && (
        <p className="hidden whitespace-pre-wrap text-sm text-slate-700 print:block print:text-[10px]">{memo}</p>
      )}
    </div>
  );
}
