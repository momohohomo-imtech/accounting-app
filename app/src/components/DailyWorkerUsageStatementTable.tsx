"use client";

import { useMemo, useState } from "react";
import { formatDate } from "@/lib/format";
import { updateDailyWorkerUsageLogRecord, deleteDailyWorkerUsageLogRecord } from "@/lib/actions/daily-worker-usage-logs";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

type StatementRow = {
  id: string;
  use_date: string;
  daily_worker_id: string;
  name: string;
  resident_id_masked: string | null;
  phone: string | null;
  note: string | null;
};

type WorkerOption = { id: string; name: string };

type SortKey = "use_date" | "name" | "resident_id_masked" | "phone";

function sortValue(r: StatementRow, key: SortKey): string {
  switch (key) {
    case "use_date":
      return r.use_date;
    case "name":
      return r.name;
    case "resident_id_masked":
      return r.resident_id_masked ?? "";
    case "phone":
      return r.phone ?? "";
  }
}

const inputClass = "w-full rounded-lg border border-slate-300 px-2 py-1 text-sm";

export function DailyWorkerUsageStatementTable({ rows, workers }: { rows: StatementRow[]; workers: WorkerOption[] }) {
  const confirm = useConfirm();
  const pending = useGlobalPending();
  const [sortKey, setSortKey] = useState<SortKey>("use_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editingId, setEditingId] = useState<string | null>(null);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const cmp = sortValue(a, sortKey).localeCompare(sortValue(b, sortKey));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function headerButton(key: SortKey, label: string) {
    return (
      <button
        type="button"
        onClick={() => handleSort(key)}
        className="inline-flex items-center justify-center gap-1 hover:text-slate-800"
      >
        {label}
        {sortKey === key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  }

  async function handleSaveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!(await confirm("수정 내용을 저장하시겠습니까?"))) return;
    await pending.run(() => Promise.resolve(updateDailyWorkerUsageLogRecord(new FormData(form))));
    setEditingId(null);
  }

  async function handleConfirmDelete(id: string) {
    if (!(await confirm("이 사용내역을 삭제하시겠습니까?", { danger: true, confirmLabel: "삭제" }))) return;
    const fd = new FormData();
    fd.append("id", id);
    await pending.run(() => Promise.resolve(deleteDailyWorkerUsageLogRecord(fd)));
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-300 text-slate-500">
          <th className="py-1.5 pr-2 text-center">번호</th>
          <th className="py-1.5 pr-2 text-center">{headerButton("use_date", "사용일자")}</th>
          <th className="py-1.5 pr-2 text-center">{headerButton("name", "이름")}</th>
          <th className="py-1.5 pr-2 text-center">{headerButton("resident_id_masked", "주민번호")}</th>
          <th className="py-1.5 pr-2 text-center">{headerButton("phone", "전화번호")}</th>
          <th className="py-1.5 pr-2 text-center">비고</th>
          <th className="py-1.5 text-center print:hidden">관리</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r, i) =>
          editingId === r.id ? (
            <tr key={r.id} className="border-b border-slate-200 bg-slate-50">
              <td colSpan={7} className="py-3 pr-2">
                <form onSubmit={handleSaveEdit} className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  <input type="hidden" name="id" value={r.id} />
                  <input type="date" name="use_date" required defaultValue={r.use_date} className={inputClass} />
                  <select name="daily_worker_id" required defaultValue={r.daily_worker_id} className={inputClass}>
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                  <input name="note" defaultValue={r.note ?? ""} placeholder="비고" className={inputClass} />
                  <div className="flex gap-2 lg:col-span-2">
                    <button
                      type="submit"
                      className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-700"
                    >
                      저장
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100"
                    >
                      취소
                    </button>
                  </div>
                </form>
              </td>
            </tr>
          ) : (
            <tr key={r.id} className="border-b border-slate-200 text-slate-700">
              <td className="py-1.5 pr-2 text-center">{i + 1}</td>
              <td className="py-1.5 pr-2 text-center">{formatDate(r.use_date)}</td>
              <td className="py-1.5 pr-2 text-center">{r.name}</td>
              <td className="py-1.5 pr-2 text-center">{r.resident_id_masked ?? "-"}</td>
              <td className="py-1.5 pr-2 text-center">{r.phone ?? "-"}</td>
              <td className="py-1.5 pr-2 text-center">{r.note ?? "-"}</td>
              <td className="py-1.5 text-center print:hidden">
                <div className="flex justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditingId(r.id)}
                    className="rounded-lg border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmDelete(r.id)}
                    className="rounded-lg border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              </td>
            </tr>
          )
        )}
        {sorted.length === 0 && (
          <tr>
            <td colSpan={7} className="py-6 text-center text-slate-400">
              해당 월의 사용내역이 없습니다.
            </td>
          </tr>
        )}
      </tbody>
      {sorted.length > 0 && (
        <tfoot>
          <tr className="border-t-2 border-slate-900 font-semibold text-slate-900">
            <td colSpan={7} className="py-2 text-center">
              총 {sorted.length}건
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}
