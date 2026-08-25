"use client";

import { deleteBackupRecord } from "@/lib/actions/backups";

export function DeleteBackupButton({ id, fileName }: { id: string; fileName: string }) {
  return (
    <form
      action={async (fd) => {
        await deleteBackupRecord(fd);
      }}
      onSubmit={(e) => {
        if (!confirm(`이 백업(${fileName})을 삭제하시겠습니까?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="fileName" value={fileName} />
      <button className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50">삭제</button>
    </form>
  );
}
