"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTool, deleteTool } from "@/lib/actions/tools";
import { ModalPortal } from "@/components/ModalPortal";
import { Button } from "@/components/ui/Button";
import { fieldClass, labelClass } from "@/components/ui/field";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { useConfirm } from "@/components/ConfirmProvider";

type Tool = { id: string; name: string; sort_order: number; note: string | null };

export function ToolEditPopup({ tool, onClose }: { tool: Tool; onClose: () => void }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [name, setName] = useState(tool.name);
  const [sortOrder, setSortOrder] = useState(String(tool.sort_order));
  const [note, setNote] = useState(tool.note ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEscapeKey(true, onClose);

  async function handleSave() {
    if (!(await confirm("수정 내용을 저장하시겠습니까?"))) return;
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.append("id", tool.id);
    fd.append("name", name);
    fd.append("sort_order", sortOrder);
    fd.append("note", note);
    const result = await updateTool(fd);
    setSaving(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  async function handleDelete() {
    setSaving(true);
    const fd = new FormData();
    fd.append("id", tool.id);
    const result = await deleteTool(fd);
    setSaving(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10">
        <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">공구 수정</h2>
          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <label className={labelClass}>공구명</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>순번</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className={fieldClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>메모</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={fieldClass} />
            </div>
          </div>

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          <div className="mt-5 flex items-center justify-between gap-2">
            {confirmingDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-red-600">정말 삭제?</span>
                <Button type="button" variant="danger" size="xs" disabled={saving} onClick={handleDelete}>
                  확인
                </Button>
                <Button type="button" variant="secondary" size="xs" onClick={() => setConfirmingDelete(false)}>
                  취소
                </Button>
              </div>
            ) : (
              <Button type="button" variant="danger" size="sm" onClick={() => setConfirmingDelete(true)}>
                삭제
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                닫기
              </Button>
              <Button type="button" size="sm" disabled={saving || !name.trim()} onClick={handleSave}>
                저장
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
