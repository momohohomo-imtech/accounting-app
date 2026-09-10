"use client";

import { useState } from "react";
import { ModalPortal } from "@/components/ModalPortal";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { fieldClass, labelClass } from "@/components/ui/field";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { ProjectPicker, type ProjectOption, type SiteOption } from "@/components/ProjectPicker";

type EditTarget = { id: string; content: string; projectName: string; siteName: string };

export function ConstructionMemoFormPopup({
  mode,
  sites,
  projects,
  initial,
  createAction,
  updateAction,
  onClose,
}: {
  mode: "create" | "edit";
  sites: SiteOption[];
  projects: ProjectOption[];
  initial?: EditTarget;
  createAction: (formData: FormData) => unknown;
  updateAction: (formData: FormData) => unknown;
  onClose: () => void;
}) {
  useEscapeKey(true, onClose);
  const confirm = useConfirm();
  const pending = useGlobalPending();
  const [projectId, setProjectId] = useState("");
  const [content, setContent] = useState(initial?.content ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!content.trim()) return;
    if (mode === "create" && !projectId) return;
    if (!(await confirm(mode === "create" ? "이 메모를 등록하시겠습니까?" : "수정 내용을 저장하시겠습니까?"))) return;

    const fd = new FormData();
    if (mode === "create") fd.append("project_id", projectId);
    else fd.append("id", initial!.id);
    fd.append("content", content);

    try {
      const action = mode === "create" ? createAction : updateAction;
      const result = await pending.run(() => Promise.resolve(action(fd)));
      if (result && typeof result === "object" && "error" in result && result.error) {
        setError(String(result.error));
        return;
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
    }
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10">
        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">{mode === "create" ? "메모 추가" : "메모 수정"}</h2>
            <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">
              닫기
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "create" ? (
              <ProjectPicker
                sites={sites}
                projects={projects}
                value={projectId}
                onChange={setProjectId}
                label="프로젝트"
                emptyLabel="프로젝트를 선택하세요"
              />
            ) : (
              <div className="text-sm text-slate-500">
                {initial?.siteName} · {initial?.projectName}
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className={labelClass}>내용</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                placeholder="관련 내용, 진행 상황 등을 기록하세요."
                className={fieldClass}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={!content.trim() || (mode === "create" && !projectId)}>
                {mode === "create" ? "등록" : "저장"}
              </Button>
              <Button type="button" variant="secondary" onClick={onClose}>
                취소
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
