"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { ConstructionMemoFormPopup } from "@/components/ConstructionMemoFormPopup";
import type { ProjectOption, SiteOption } from "@/components/ProjectPicker";

type Memo = {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
  project_id: string;
  project_name: string;
  site_name: string;
};

type Popup = { mode: "create" } | { mode: "edit"; memo: Memo };

export function ConstructionMemoList({
  memos,
  sites,
  projects,
  createAction,
  updateAction,
  deleteAction,
}: {
  memos: Memo[];
  sites: SiteOption[];
  projects: ProjectOption[];
  createAction: (formData: FormData) => unknown;
  updateAction: (formData: FormData) => unknown;
  deleteAction: (formData: FormData) => unknown;
}) {
  const pending = useGlobalPending();
  const [popup, setPopup] = useState<Popup | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    const fd = new FormData();
    fd.append("id", id);
    await pending.run(() => Promise.resolve(deleteAction(fd)));
    setConfirmDeleteId(null);
  }

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <Button type="button" onClick={() => setPopup({ mode: "create" })} disabled={projects.length === 0}>
          + 메모 추가
        </Button>
      </div>

      <div className="space-y-3">
        {memos.map((m) => (
          <div key={m.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs text-slate-400">
                {formatDate(m.created_at)}
                {m.updated_at !== m.created_at && ` (수정 ${formatDate(m.updated_at)})`}
                <span className="mx-1.5 text-slate-300">|</span>
                <span className="font-medium text-slate-600">{m.site_name}</span>
                <span className="mx-1">·</span>
                <span className="font-medium text-slate-600">{m.project_name}</span>
              </p>
              <div className="flex shrink-0 items-center gap-2 print:hidden">
                {confirmDeleteId === m.id ? (
                  <>
                    <span className="text-xs font-medium text-red-600">정말 삭제?</span>
                    <Button type="button" variant="danger" size="xs" onClick={() => handleDelete(m.id)}>
                      확인
                    </Button>
                    <Button type="button" variant="secondary" size="xs" onClick={() => setConfirmDeleteId(null)}>
                      취소
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      onClick={() => setPopup({ mode: "edit", memo: m })}
                    >
                      수정
                    </Button>
                    <Button type="button" variant="danger" size="xs" onClick={() => setConfirmDeleteId(m.id)}>
                      삭제
                    </Button>
                  </>
                )}
              </div>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{m.content}</p>
          </div>
        ))}
        {memos.length === 0 && <p className="py-8 text-center text-sm text-slate-400">작성된 메모가 없습니다.</p>}
      </div>

      {popup?.mode === "create" && (
        <ConstructionMemoFormPopup
          mode="create"
          sites={sites}
          projects={projects}
          createAction={createAction}
          updateAction={updateAction}
          onClose={() => setPopup(null)}
        />
      )}
      {popup?.mode === "edit" && (
        <ConstructionMemoFormPopup
          mode="edit"
          sites={sites}
          projects={projects}
          initial={{
            id: popup.memo.id,
            content: popup.memo.content,
            projectName: popup.memo.project_name,
            siteName: popup.memo.site_name,
          }}
          createAction={createAction}
          updateAction={updateAction}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  );
}
