"use client";

import { useMemo, useState } from "react";
import { formatDate } from "@/lib/format";
import { RestoreBackupButton } from "@/components/RestoreBackupButton";
import { DeleteBackupButton } from "@/components/DeleteBackupButton";

type BackupRow = {
  id: string;
  file_name: string;
  backup_type: string;
  file_size_mb: number | null;
  created_at: string;
  signedUrl: string | null;
};

type SortKey = "file_name" | "backup_type" | "file_size_mb" | "created_at";

function sortValue(b: BackupRow, key: SortKey): string | number {
  switch (key) {
    case "file_name":
      return b.file_name;
    case "backup_type":
      return b.backup_type;
    case "file_size_mb":
      return b.file_size_mb ?? 0;
    case "created_at":
      return b.created_at;
  }
}

export function BackupsTable({ backups }: { backups: BackupRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function headerButton(key: SortKey, label: string) {
    return (
      <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 hover:text-slate-800">
        {label}
        {sortKey === key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  }

  const sorted = useMemo(() => {
    if (!sortKey) return backups;
    const copy = [...backups];
    copy.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [backups, sortKey, sortDir]);

  return (
    <table className="w-full min-w-[600px] text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-slate-500">
          <th className="pb-2 pr-4">{headerButton("file_name", "파일명")}</th>
          <th className="pb-2 pr-4">{headerButton("backup_type", "유형")}</th>
          <th className="pb-2 pr-4">{headerButton("file_size_mb", "크기(MB)")}</th>
          <th className="pb-2 pr-4">{headerButton("created_at", "생성일")}</th>
          <th className="pb-2 text-right">관리</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((b) => (
          <tr key={b.id} className="border-b border-slate-100 last:border-0">
            <td className="py-2 pr-4 text-slate-700">{b.file_name}</td>
            <td className="py-2 pr-4 text-slate-700">{b.backup_type === "manual" ? "수동" : "자동"}</td>
            <td className="py-2 pr-4 text-slate-700">{b.file_size_mb ?? "-"}</td>
            <td className="py-2 pr-4 text-slate-600">{formatDate(b.created_at)}</td>
            <td className="py-2 text-right">
              <div className="flex justify-end gap-2">
                {b.signedUrl && (
                  <a
                    href={b.signedUrl}
                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
                  >
                    다운로드
                  </a>
                )}
                <RestoreBackupButton fileName={b.file_name} />
                <DeleteBackupButton id={b.id} fileName={b.file_name} />
              </div>
            </td>
          </tr>
        ))}
        {sorted.length === 0 && (
          <tr>
            <td colSpan={5} className="py-8 text-center text-slate-400">
              백업 이력이 없습니다.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
