"use client";

import { useState } from "react";
import { deleteBackupRecord } from "@/lib/actions/backups";

export function DeleteBackupButton({ id, fileName }: { id: string; fileName: string }) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <form
        action={async (fd) => {
          await deleteBackupRecord(fd);
        }}
        className="flex items-center gap-1"
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
          onClick={() => setConfirming(false)}
          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
        >
          취소
        </button>
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
