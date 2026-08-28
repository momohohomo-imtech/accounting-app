"use client";

import { useEffect, useState } from "react";
import { getWorkLogGroupDetail, updateWorkLogMemo, type WorkLogDetailEntry } from "@/lib/actions/worklogs";
import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/field";

function formatMonthDay(dateKey: string) {
  const [, m, d] = dateKey.split("-");
  return `${Number(m)}월${Number(d)}일`;
}

function MemoRow({ entry }: { entry: WorkLogDetailEntry }) {
  const [editing, setEditing] = useState(false);
  const [memo, setMemo] = useState(entry.content ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const fd = new FormData();
    fd.append("id", entry.id);
    fd.append("content", memo);
    await updateWorkLogMemo(fd);
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-900">{formatMonthDay(entry.log_date)}</span>
        {!editing && (
          <Button type="button" variant="secondary" size="xs" onClick={() => setEditing(true)}>
            {entry.content ? "메모 수정" : "메모 추가"}
          </Button>
        )}
      </div>
      {editing ? (
        <div className="mt-2 flex items-start gap-2">
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={2}
            placeholder="메모 입력"
            className={`${fieldClass} flex-1`}
          />
          <div className="flex shrink-0 flex-col gap-1">
            <Button type="button" size="xs" disabled={saving} onClick={save}>
              저장
            </Button>
            <Button type="button" variant="secondary" size="xs" disabled={saving} onClick={() => setEditing(false)}>
              취소
            </Button>
          </div>
        </div>
      ) : (
        entry.content && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{entry.content}</p>
      )}
    </div>
  );
}

export function WorkLogGroupDetailPopup({
  year,
  siteId,
  siteName,
  siteColor,
  title,
  onClose,
}: {
  year: number;
  siteId: string;
  siteName: string;
  siteColor: string;
  title: string;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<WorkLogDetailEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getWorkLogGroupDetail(year, siteId, title).then((data) => {
      if (!cancelled) setEntries(data);
    });
    return () => {
      cancelled = true;
    };
  }, [year, siteId, title]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm text-slate-500">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: siteColor }} />
              {siteName}
            </p>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {year}년 전체 내역{entries !== null && ` · 총 ${entries.length}일`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">
            닫기
          </button>
        </div>

        {entries === null ? (
          <p className="py-8 text-center text-sm text-slate-400">불러오는 중...</p>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <MemoRow key={e.id} entry={e} />
            ))}
            {entries.length === 0 && <p className="py-8 text-center text-sm text-slate-400">내역이 없습니다.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
