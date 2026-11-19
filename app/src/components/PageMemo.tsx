"use client";

import { useState } from "react";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { isLeaveDialogFocus, useUnsavedGuard } from "@/components/UnsavedChangesProvider";
import { fieldClass } from "@/components/ui/field";
import { Card } from "@/components/ui/Card";

// 페이지 전체에서 공유하는 자유 메모장 — 입력칸에서 벗어나면 자동 저장. 쓰는 중에 뒤로가기 등으로 화면을 떠나면(입력칸에서 벗어나지
// 않은 채) 저장할지 물어봄(useUnsavedGuard, 사용자 요청 11/19).
// bare: 카드 없이 입력칸만(필터 줄 옆 빈자리 등에 끼워 넣을 때).
export function PageMemo({
  initialContent,
  placeholder,
  label,
  save,
  rows = 4,
  bare = false,
}: {
  initialContent: string;
  placeholder: string;
  /** 저장 확인창에 보일 이름(예: "대시보드 메모") */
  label: string;
  save: (fd: FormData) => Promise<{ error?: string }>;
  rows?: number;
  bare?: boolean;
}) {
  const [content, setContent] = useState(initialContent);
  const [saved, setSaved] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const globalPending = useGlobalPending();

  // 저장됐으면 true — 실패하면 알리고 false(쓴 글은 그대로, 다음에 칸을 벗어날 때 다시 저장)
  async function persist(): Promise<boolean> {
    if (content === saved) return true;
    const fd = new FormData();
    fd.append("content", content);
    setSaving(true);
    const result = await globalPending.run(() => save(fd));
    setSaving(false);
    if (result?.error) {
      alert(`메모를 저장하지 못했습니다: ${result.error}`);
      return false;
    }
    setSaved(content);
    return true;
  }

  useUnsavedGuard({
    dirty: content !== saved && !saving,
    value: content,
    label,
    save: persist,
    discard: () => setContent(saved),
  });

  const textarea = (
    <textarea
      value={content}
      onChange={(e) => setContent(e.target.value)}
      onBlur={(e) => {
        // 저장 확인창이 뜨면서 벗어난 것 — 확인창에서 정함
        if (isLeaveDialogFocus(e.relatedTarget)) return;
        void persist();
      }}
      rows={rows}
      placeholder={placeholder}
      className={`${fieldClass} resize-y print:hidden`}
    />
  );
  return bare ? textarea : <Card className="print:hidden">{textarea}</Card>;
}
