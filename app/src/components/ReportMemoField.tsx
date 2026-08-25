"use client";

import { useMemoEditor } from "@/components/ProjectMemoProvider";
import { fieldClass, labelClass } from "@/components/ui/field";
import { Button } from "@/components/ui/Button";

export function ReportMemoField() {
  const { memo, setMemo, dirty, isPending, save } = useMemoEditor();

  return (
    <div className="space-y-2">
      <label className={labelClass}>메모</label>
      <textarea
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        rows={8}
        placeholder="이 프로젝트에 대한 메모를 남겨주세요"
        className={fieldClass}
      />
      <Button type="button" variant="secondary" size="sm" className="print:hidden" onClick={save} disabled={isPending || !dirty}>
        {isPending ? "저장 중..." : "메모 저장"}
      </Button>
    </div>
  );
}
