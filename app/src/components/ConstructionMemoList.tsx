"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format";
import { fieldClass, labelClass } from "@/components/ui/field";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

type Memo = { id: string; content: string; created_at: string; updated_at: string };

export function ConstructionMemoList({
  projectId,
  memos,
  createAction,
  updateAction,
  deleteAction,
}: {
  projectId: string;
  memos: Memo[];
  createAction: (formData: FormData) => unknown;
  updateAction: (formData: FormData) => unknown;
  deleteAction: (formData: FormData) => unknown;
}) {
  const confirm = useConfirm();
  const pending = useGlobalPending();
  const [content, setContent] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!content.trim()) return;
    const fd = new FormData();
    fd.append("project_id", projectId);
    fd.append("content", content);
    try {
      const result = await pending.run(() => Promise.resolve(createAction(fd)));
      if (result && typeof result === "object" && "error" in result && result.error) {
        setFormError(String(result.error));
        return;
      }
      setFormError(null);
      setContent("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
    }
  }

  async function handleUpdate(id: string) {
    if (!editContent.trim()) return;
    if (!(await confirm("수정 내용을 저장하시겠습니까?"))) return;
    const fd = new FormData();
    fd.append("id", id);
    fd.append("content", editContent);
    await pending.run(() => Promise.resolve(updateAction(fd)));
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    const fd = new FormData();
    fd.append("id", id);
    await pending.run(() => Promise.resolve(deleteAction(fd)));
    setConfirmDeleteId(null);
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleCreate}
        className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden"
      >
        <label className={labelClass}>새 메모</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          placeholder="관련 내용, 진행 상황 등을 기록하세요."
          className={fieldClass}
        />
        {formError && <p className="text-sm text-red-600">{formError}</p>}
        <div>
          <Button type="submit" size="sm" disabled={!content.trim()}>
            메모 등록
          </Button>
        </div>
      </form>

      <div className="space-y-3">
        {memos.map((m) => (
          <div key={m.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {editingId === m.id ? (
              <div className="space-y-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={3}
                  className={fieldClass}
                />
                <div className="flex gap-2">
                  <Button type="button" size="xs" onClick={() => handleUpdate(m.id)}>
                    저장
                  </Button>
                  <Button type="button" variant="secondary" size="xs" onClick={() => setEditingId(null)}>
                    취소
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs text-slate-400">
                    {formatDate(m.created_at)}
                    {m.updated_at !== m.created_at && ` (수정 ${formatDate(m.updated_at)})`}
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
                          onClick={() => {
                            setEditingId(m.id);
                            setEditContent(m.content);
                          }}
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
              </>
            )}
          </div>
        ))}
        {memos.length === 0 && <p className="py-8 text-center text-sm text-slate-400">작성된 메모가 없습니다.</p>}
      </div>
    </div>
  );
}
