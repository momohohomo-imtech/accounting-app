"use client";

import { useMemoEditor } from "@/components/ProjectMemoProvider";

export function ReportCloseButton() {
  const { dirty, isPending, close } = useMemoEditor();

  return (
    <button
      type="button"
      onClick={close}
      disabled={isPending}
      className="text-sm text-slate-500 hover:text-slate-800 print:hidden disabled:opacity-50"
    >
      {isPending ? "저장 중..." : dirty ? "저장 후 닫기" : "닫기"}
    </button>
  );
}
