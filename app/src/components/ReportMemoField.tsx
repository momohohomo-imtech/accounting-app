"use client";

import { useMemoEditor } from "@/components/ProjectMemoProvider";
import { fieldClass, labelClass } from "@/components/ui/field";
import { Button } from "@/components/ui/Button";

export function ReportMemoField() {
  const { memo, setMemo, dirty, isPending, save, error } = useMemoEditor();
  const hasMemo = memo.trim().length > 0;

  return (
    <div className={`space-y-2 ${hasMemo ? "" : "print:hidden"}`}>
      <label className={`${labelClass} print:text-[10px]`}>메모</label>
      <textarea
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        rows={8}
        placeholder="이 프로젝트에 대한 메모를 남겨주세요"
        className={`${fieldClass} print:hidden`}
      />
      {hasMemo && <p className="hidden text-xs whitespace-pre-wrap text-slate-700 print:block">{memo}</p>}
      {error && <p className="text-sm text-red-600 print:hidden">{error}</p>}
      <Button type="button" variant="secondary" size="sm" className="print:hidden" onClick={save} disabled={isPending || !dirty}>
        {isPending ? "저장 중..." : "메모 저장"}
      </Button>
    </div>
  );
}
