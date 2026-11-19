"use client";

import { useState } from "react";
import { ModalPortal } from "@/components/ModalPortal";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { fieldClass, labelClass } from "@/components/ui/field";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { useUnsavedGuard } from "@/components/UnsavedChangesProvider";
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
  const confirm = useConfirm();
  const pending = useGlobalPending();
  const [projectId, setProjectId] = useState("");
  const [content, setContent] = useState(initial?.content ?? "");
  const [error, setError] = useState<string | null>(null);
  const initialContent = initial?.content ?? "";

  // 저장(등록·수정)되면 팝업을 닫고 true — 못 하면 이유를 보여 주고 false(쓴 글은 그대로)
  async function persist(): Promise<boolean> {
    if (!content.trim()) {
      setError("내용을 입력해야 저장할 수 있습니다.");
      return false;
    }
    if (mode === "create" && !projectId) {
      setError("프로젝트를 선택해야 저장할 수 있습니다.");
      return false;
    }
    const fd = new FormData();
    if (mode === "create") fd.append("project_id", projectId);
    else fd.append("id", initial!.id);
    fd.append("content", content);

    try {
      const action = mode === "create" ? createAction : updateAction;
      const result = await pending.run(() => Promise.resolve(action(fd)));
      if (result && typeof result === "object" && "error" in result && result.error) {
        setError(String(result.error));
        return false;
      }
      onClose();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
      return false;
    }
  }

  // 작성 중에 닫기·취소·ESC·뒤로가기를 하면 저장할지 물어봄(사용자 요청 11/19)
  const leave = useUnsavedGuard({
    dirty: content !== initialContent && (mode === "edit" || content.trim() !== ""),
    value: content,
    label: mode === "create" ? "새 공사 메모" : "공사 메모",
    save: persist,
    discard: onClose,
  });
  const requestClose = async () => {
    if (await leave()) onClose();
  };
  useEscapeKey(true, () => void requestClose());

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!content.trim()) return;
    if (mode === "create" && !projectId) return;
    if (!(await confirm(mode === "create" ? "이 메모를 등록하시겠습니까?" : "수정 내용을 저장하시겠습니까?"))) return;
    await persist();
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-ink/50 p-4 py-10">
        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">{mode === "create" ? "메모 추가" : "메모 수정"}</h2>
            <button type="button" onClick={requestClose} className="text-sm text-slate-500 hover:text-slate-800">
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
              <Button type="button" variant="secondary" onClick={requestClose}>
                취소
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
