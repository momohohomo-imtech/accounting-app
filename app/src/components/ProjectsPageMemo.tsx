"use client";

import { useRef, useState } from "react";
import { updateProjectsPageMemo } from "@/lib/actions/projectsPageMemo";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { fieldClass } from "@/components/ui/field";

export function ProjectsPageMemo({ initialContent }: { initialContent: string }) {
  const [content, setContent] = useState(initialContent);
  const lastSavedRef = useRef(initialContent);
  const globalPending = useGlobalPending();

  async function handleBlur() {
    if (content === lastSavedRef.current) return;
    const fd = new FormData();
    fd.append("content", content);
    await globalPending.run(() => updateProjectsPageMemo(fd));
    lastSavedRef.current = content;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm print:hidden">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={handleBlur}
        rows={4}
        placeholder="프로젝트 관련 메모..."
        className={`${fieldClass} resize-y`}
      />
    </div>
  );
}
