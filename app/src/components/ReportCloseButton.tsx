"use client";

import { useMemoEditor } from "@/components/ProjectMemoProvider";

export function ReportCloseButton() {
  const { isPending, close } = useMemoEditor();

  return (
    <button
      type="button"
      onClick={close}
      disabled={isPending}
      className="text-sm text-slate-500 hover:text-slate-800 print:hidden disabled:opacity-50"
    >
      {/* 메모를 고친 채 닫으면 저장할지 물어봄(ProjectMemoProvider) */}
      {isPending ? "저장 중..." : "닫기"}
    </button>
  );
}
