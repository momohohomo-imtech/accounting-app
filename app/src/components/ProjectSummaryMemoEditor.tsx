"use client";

import { useState, useTransition } from "react";
import { updateProjectMemo } from "@/lib/actions/projects";
import { Button } from "@/components/ui/Button";

// 프로젝트 요약 카드 안에서 바로 메모를 쓰고 저장할 수 있게 — projects.memo를 그대로 씀
// (프로젝트 수정 팝업의 메모와 같은 필드). 내용이 있을 때만 인쇄에도 나온다.
export function ProjectSummaryMemoEditor({ projectId, initialMemo }: { projectId: string; initialMemo: string | null }) {
  const [memo, setMemo] = useState(initialMemo ?? "");
  const [savedMemo, setSavedMemo] = useState(initialMemo ?? "");
  const [isPending, startTransition] = useTransition();
  const dirty = memo !== savedMemo;
  const hasMemo = memo.trim().length > 0;

  function save() {
    if (!dirty) return;
    const fd = new FormData();
    fd.set("id", projectId);
    fd.set("memo", memo);
    startTransition(async () => {
      await updateProjectMemo(fd);
      setSavedMemo(memo);
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
      {hasMemo && (
        <p className="hidden whitespace-pre-wrap text-sm text-slate-700 print:block print:text-[10px]">{memo}</p>
      )}
    </div>
  );
}
