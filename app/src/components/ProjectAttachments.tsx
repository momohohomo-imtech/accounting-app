"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadAttachment, deleteAttachment } from "@/lib/actions/attachments";
import { formatFileSize } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/field";

export type AttachmentItem = {
  id: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  memo: string | null;
  url: string | null;
};

function FileIcon() {
  return (
    <svg viewBox="0 0 20 20" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.5} className="shrink-0 text-slate-400">
      <path d="M5 2h7l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
      <path d="M12 2v3h3" />
    </svg>
  );
}

function AttachmentRow({ item, onChanged }: { item: AttachmentItem; onChanged: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isImage = item.mime_type?.startsWith("image/");

  async function remove() {
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.append("id", item.id);
    const result = await deleteAttachment(fd);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onChanged();
  }

  return (
    <li className="flex items-center gap-2 py-1.5 text-sm">
      {isImage && item.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.url} alt={item.file_name} className="h-10 w-10 shrink-0 rounded object-cover" />
      ) : (
        <FileIcon />
      )}
      <div className="min-w-0 flex-1">
        {item.url ? (
          <a href={item.url} target="_blank" rel="noreferrer" className="truncate text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900">
            {item.file_name}
          </a>
        ) : (
          <span className="truncate text-slate-400">{item.file_name} (링크 만료됨, 새로고침 해주세요)</span>
        )}
        {item.memo && <p className="truncate text-xs text-slate-400">{item.memo}</p>}
      </div>
      <span className="shrink-0 font-mono text-xs text-slate-400">{formatFileSize(item.file_size)}</span>
      {confirmDelete ? (
        <span className="flex shrink-0 items-center gap-1 print:hidden">
          <Button variant="danger" size="xs" type="button" disabled={pending} onClick={remove}>
            확인
          </Button>
          <Button variant="secondary" size="xs" type="button" onClick={() => setConfirmDelete(false)}>
            취소
          </Button>
        </span>
      ) : (
        <Button variant="danger" size="xs" type="button" className="shrink-0 print:hidden" onClick={() => setConfirmDelete(true)}>
          삭제
        </Button>
      )}
      {error && <span className="w-full text-xs text-red-600 print:hidden">{error}</span>}
    </li>
  );
}

export function ProjectAttachments({ projectId, items }: { projectId: string; items: AttachmentItem[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await uploadAttachment(formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="mb-2 text-sm font-semibold text-slate-900">첨부파일 (사양서·도면·사진 등)</p>

      {items.length > 0 ? (
        <ul className="mb-2 divide-y divide-slate-100">
          {items.map((it) => (
            <AttachmentRow key={it.id} item={it} onChanged={() => router.refresh()} />
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-sm text-slate-400">첨부된 파일이 없습니다.</p>
      )}

      <form action={handleUpload} className="flex flex-wrap items-end gap-2 print:hidden">
        <input type="hidden" name="project_id" value={projectId} />
        <input name="file" type="file" required className="text-xs" />
        <input name="memo" placeholder="메모 (선택)" className={`${fieldClass} w-40`} />
        <Button type="submit" size="xs" disabled={pending}>
          {pending ? "업로드 중..." : "+ 업로드"}
        </Button>
        {error && <span className="w-full text-xs text-red-600">{error}</span>}
      </form>
    </div>
  );
}
