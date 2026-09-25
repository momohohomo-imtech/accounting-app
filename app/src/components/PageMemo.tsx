"use client";

import { useRef, useState } from "react";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { fieldClass } from "@/components/ui/field";
import { Card } from "@/components/ui/Card";

// 페이지 전체에서 공유하는 자유 메모장 — 입력칸에서 벗어나면 자동 저장.
// bare: 카드 없이 입력칸만(필터 줄 옆 빈자리 등에 끼워 넣을 때).
export function PageMemo({
  initialContent,
  placeholder,
  save,
  rows = 4,
  bare = false,
}: {
  initialContent: string;
  placeholder: string;
  save: (fd: FormData) => Promise<{ error?: string }>;
  rows?: number;
  bare?: boolean;
}) {
  const [content, setContent] = useState(initialContent);
  const lastSavedRef = useRef(initialContent);
  const globalPending = useGlobalPending();

  async function handleBlur() {
    if (content === lastSavedRef.current) return;
    const fd = new FormData();
    fd.append("content", content);
    const result = await globalPending.run(() => save(fd));
    if (result?.error) {
      alert(`메모를 저장하지 못했습니다: ${result.error}`);
      return;
    }
    lastSavedRef.current = content;
  }

  const textarea = (
    <textarea
      value={content}
      onChange={(e) => setContent(e.target.value)}
      onBlur={handleBlur}
      rows={rows}
      placeholder={placeholder}
      className={`${fieldClass} resize-y print:hidden`}
    />
  );
  return bare ? textarea : <Card className="print:hidden">{textarea}</Card>;
}
