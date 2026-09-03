"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { fieldClass, labelClass } from "@/components/ui/field";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { formatDate } from "@/lib/format";

type Note = { id: string; title: string; content: string | null; memo: string | null; created_at: string };
type ActionResult = { error?: string } | void;
type Action = (formData: FormData) => Promise<ActionResult>;

function NoteForm({
  defaultValues,
  onCancel,
  onSubmit,
  submitLabel,
}: {
  defaultValues?: Partial<Note>;
  onCancel: () => void;
  onSubmit: Action;
  submitLabel: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const globalPending = useGlobalPending();
  const [title, setTitle] = useState(defaultValues?.title ?? "");
  const [content, setContent] = useState(defaultValues?.content ?? "");
  const [memo, setMemo] = useState(defaultValues?.memo ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!(await confirm(`${submitLabel}하시겠습니까?`))) return;
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.append("title", title);
    fd.append("content", content ?? "");
    fd.append("memo", memo ?? "");
    const result = await globalPending.run(() => onSubmit(fd));
    setPending(false);
    if (result && "error" in result && result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    onCancel();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-col gap-1">
        <label className={labelClass}>제목</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required className={fieldClass} />
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelClass}>내용</label>
        <textarea value={content ?? ""} onChange={(e) => setContent(e.target.value)} rows={4} className={fieldClass} />
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelClass}>메모</label>
        <textarea value={memo ?? ""} onChange={(e) => setMemo(e.target.value)} rows={2} className={fieldClass} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {submitLabel}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          취소
        </Button>
      </div>
    </form>
  );
}

function KnowHowItem({
  note,
  updateAction,
  deleteAction,
}: {
  note: Note;
  updateAction: Action;
  deleteAction: Action;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const globalPending = useGlobalPending();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (!(await confirm("이 노하우를 삭제하시겠습니까?", { danger: true }))) return;
    setPending(true);
    const fd = new FormData();
    fd.append("id", note.id);
    await globalPending.run(() => deleteAction(fd));
    setPending(false);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
      >
        <span className="font-medium text-slate-800">{note.title}</span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-slate-400">
          {formatDate(note.created_at)}
          <span>{open ? "▲" : "▼"}</span>
        </span>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-3 py-3">
          {editing ? (
            <NoteForm
              defaultValues={note}
              submitLabel="저장"
              onCancel={() => setEditing(false)}
              onSubmit={async (fd) => {
                fd.append("id", note.id);
                return updateAction(fd);
              }}
            />
          ) : (
            <div className="space-y-2">
              <p className="whitespace-pre-wrap text-sm text-slate-700">{note.content || "-"}</p>
              {note.memo && (
                <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-xs text-slate-500">메모: {note.memo}</p>
              )}
              <div className="flex justify-end gap-2 print:hidden">
                <Button variant="secondary" size="xs" type="button" onClick={() => setEditing(true)}>
                  수정
                </Button>
                <Button variant="danger" size="xs" type="button" disabled={pending} onClick={handleDelete}>
                  삭제
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function KnowHowSection({
  title,
  notes,
  createAction,
  updateAction,
  deleteAction,
}: {
  title: string;
  notes: Note[];
  createAction: Action;
  updateAction: Action;
  deleteAction: Action;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {!adding && (
          <Button size="sm" type="button" onClick={() => setAdding(true)}>
            + 노하우 추가
          </Button>
        )}
      </div>

      {adding && <NoteForm submitLabel="추가" onCancel={() => setAdding(false)} onSubmit={createAction} />}

      <div className="space-y-2">
        {notes.map((n) => (
          <KnowHowItem key={n.id} note={n} updateAction={updateAction} deleteAction={deleteAction} />
        ))}
        {notes.length === 0 && !adding && (
          <p className="py-6 text-center text-sm text-slate-400">등록된 노하우가 없습니다.</p>
        )}
      </div>
    </div>
  );
}
