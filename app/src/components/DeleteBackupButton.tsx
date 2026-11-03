"use client";

import { useState } from "react";
import { deleteBackupRecord } from "@/lib/actions/backups";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

export function DeleteBackupButton({ id, fileName }: { id: string; fileName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useGlobalPending();

  if (confirming) {
    return (
      <form
        action={async (fd) => {
          setError(null);
          // 실패하면 이유를 보여 줌(예전엔 결과를 버려서 안 지워져도 아무 표시가 없었음)
          const result = await pending.run(() => deleteBackupRecord(fd)).catch(() => ({ error: "삭제하지 못했습니다(연결 오류)." }));
          if (result?.error) setError(result.error);
        }}
        className="flex flex-wrap items-center gap-1"
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="fileName" value={fileName} />
        <span className="text-xs font-medium text-red-600">정말 삭제?</span>
        <button
          type="submit"
          className="rounded-lg border border-red-300 bg-red-600 px-2.5 py-1 text-xs text-white hover:bg-red-700"
        >
          확인
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
        >
          취소
        </button>
        {error && <span className="basis-full text-xs text-red-600">{error}</span>}
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
    >
      삭제
    </button>
  );
}
