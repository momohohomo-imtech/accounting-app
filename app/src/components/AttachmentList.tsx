"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteAttachment, prepareAttachmentUpload, saveUploadedAttachment } from "@/lib/actions/attachments";
import { uploadToSignedUrl } from "@/lib/supabase/signedUpload";
import { storageUploadErrorMessage } from "@/lib/fileUpload";
import { formatFileSize } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { inlineFieldClass } from "@/components/ui/field";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

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
  const globalPending = useGlobalPending();
  const isImage = item.mime_type?.startsWith("image/");

  async function remove() {
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.append("id", item.id);
    const result = await globalPending.run(() => deleteAttachment(fd));
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
      <span className="shrink-0 tabular-nums text-xs text-slate-400">{formatFileSize(item.file_size)}</span>
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

export function AttachmentList({
  projectId,
  workDate,
  items,
  title = "첨부파일 (사양서·도면·사진 등)",
}: {
  projectId?: string;
  workDate?: string;
  items: AttachmentItem[];
  /** 빈 문자열을 넘기면 제목을 안 보여줌 — 이미 바깥에서 접이식 섹션 제목으로 보여주고 있을 때. */
  title?: string;
}) {
  const router = useRouter();
  const globalPending = useGlobalPending();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 파일은 브라우저에서 저장소로 바로 올림(서버 한도 4.5MB를 안 거침) — 순서와 이유는 actions/attachments.ts 맨 위.
  async function uploadFile(file: File, memo: string): Promise<string | null> {
    const target = { projectId: projectId ?? null, workDate: workDate ?? null };
    const prepared = await prepareAttachmentUpload({ ...target, fileName: file.name });
    if (prepared.error !== undefined) return prepared.error;
    let uploadError: string | null;
    try {
      ({ error: uploadError } = await uploadToSignedUrl("project-files", prepared.path, prepared.token, file));
    } catch (err) {
      uploadError = err instanceof Error ? err.message : "인터넷 연결을 확인해 주세요.";
    }
    if (uploadError) return storageUploadErrorMessage(uploadError, file.size);
    const saved = await saveUploadedAttachment({
      ...target,
      path: prepared.path,
      fileName: file.name,
      mimeType: file.type || null,
      size: file.size,
      memo: memo.trim() || null,
    });
    return saved?.error ?? null;
  }

  // onSubmit(form action 아님) — 올리기가 실패해도 고른 파일·메모가 지워지지 않게.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("파일을 선택해주세요.");
      return;
    }
    setPending(true);
    setError(null);
    const uploadError = await globalPending.run(() => uploadFile(file, String(fd.get("memo") ?? "")));
    setPending(false);
    if (uploadError) {
      setError(uploadError);
      return;
    }
    form.reset();
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      {title && <p className="mb-2 text-sm font-semibold text-slate-900">{title}</p>}

      {items.length > 0 ? (
        <ul className="mb-2 divide-y divide-slate-100">
          {items.map((it) => (
            <AttachmentRow key={it.id} item={it} onChanged={() => router.refresh()} />
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-sm text-slate-400">첨부된 파일이 없습니다.</p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 print:hidden">
        <input name="file" type="file" required className="text-xs" />
        <input name="memo" placeholder="메모 (선택)" className={`${inlineFieldClass} w-40`} />
        <Button type="submit" size="xs" disabled={pending}>
          {pending ? "업로드 중..." : "+ 업로드"}
        </Button>
        {error && <span className="w-full text-xs text-red-600">{error}</span>}
      </form>
    </div>
  );
}
