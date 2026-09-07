"use client";

import { useMemo, useState } from "react";
import { formatDate, formatWon } from "@/lib/format";
import { updateDailyWorkerUsageLogRecord, deleteDailyWorkerUsageLogRecord } from "@/lib/actions/daily-worker-usage-logs";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

export type StatementRow = {
  id: string;
  use_date: string;
  daily_worker_id: string;
  name: string;
  resident_id_masked: string | null;
  phone: string | null;
  daily_wage: number | null;
  note: string | null;
};

type WorkerOption = { id: string; name: string };

type DisplayItem =
  | { kind: "entry"; row: StatementRow; monthlyCount: number }
  | { kind: "subtotal"; days: number; amount: number }
  | { kind: "gap" };

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
// 한 사람당 한 달 최대 사용일수 — 이 날짜를 넘어가면(8일째부터) 카운트를 빨간 글씨로 경고.
export const MONTHLY_DAY_LIMIT = 7;

// 같은 근로자의 날짜가 하루 간격으로 이어지면 한 블록으로 묶어 소계를 내고,
// 블록이 바뀌는 지점(다른 근로자로 넘어가거나 날짜가 끊길 때)마다 빈 줄을 끼워 넣는다.
export function buildStatementDisplayItems(rows: StatementRow[]): DisplayItem[] {
  const byWorker = new Map<string, StatementRow[]>();
  for (const r of rows) {
    const list = byWorker.get(r.daily_worker_id) ?? [];
    list.push(r);
    byWorker.set(r.daily_worker_id, list);
  }

  // 근로자별로 이번 달 몇 번째 사용일인지(연속 여부와 무관하게 월 전체 누적) 미리 계산.
  const monthlyCountByRowId = new Map<string, number>();
  for (const list of byWorker.values()) {
    const sorted = [...list].sort((a, b) => a.use_date.localeCompare(b.use_date));
    sorted.forEach((r, i) => monthlyCountByRowId.set(r.id, i + 1));
  }

  const groups = Array.from(byWorker.values());
  groups.sort((a, b) => {
    const aMax = a.reduce((m, r) => (r.use_date > m ? r.use_date : m), a[0].use_date);
    const bMax = b.reduce((m, r) => (r.use_date > m ? r.use_date : m), b[0].use_date);
    return bMax.localeCompare(aMax);
  });

  const items: DisplayItem[] = [];
  for (const group of groups) {
    const sorted = [...group].sort((a, b) => a.use_date.localeCompare(b.use_date));
    let run: StatementRow[] = [];

    const flushRun = () => {
      if (run.length === 0) return;
      run.forEach((r) =>
        items.push({ kind: "entry", row: r, monthlyCount: monthlyCountByRowId.get(r.id) ?? 1 })
      );
      const amount = run.reduce((s, r) => s + (r.daily_wage ?? 0), 0);
      items.push({ kind: "subtotal", days: run.length, amount });
      items.push({ kind: "gap" });
      run = [];
    };

    sorted.forEach((r, i) => {
      if (i === 0) {
        run.push(r);
        return;
      }
      const diffDays = Math.round(
        (new Date(r.use_date).getTime() - new Date(sorted[i - 1].use_date).getTime()) / ONE_DAY_MS
      );
      if (diffDays === 1) {
        run.push(r);
      } else {
        flushRun();
        run.push(r);
      }
    });
    flushRun();
  }

  while (items.length > 0 && items[items.length - 1].kind === "gap") items.pop();
  return items;
}

const inputClass = "w-full rounded-lg border border-slate-300 px-2 py-1 text-sm";
const COLS = 8;

export function DailyWorkerUsageStatementTable({ rows, workers }: { rows: StatementRow[]; workers: WorkerOption[] }) {
  const confirm = useConfirm();
  const pending = useGlobalPending();
  const [editingId, setEditingId] = useState<string | null>(null);

  const items = useMemo(() => buildStatementDisplayItems(rows), [rows]);
  const rowNoById = useMemo(() => {
    const map = new Map<string, number>();
    let n = 0;
    for (const item of items) {
      if (item.kind === "entry") map.set(item.row.id, ++n);
    }
    return map;
  }, [items]);
  const total = rows.reduce((s, r) => s + (r.daily_wage ?? 0), 0);

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
          <th className="py-1.5 pr-2 text-center">사용일자</th>
          <th className="py-1.5 pr-2 text-center">이름</th>
          <th className="py-1.5 pr-2 text-center">주민번호</th>
          <th className="py-1.5 pr-2 text-center">전화번호</th>
          <th className="py-1.5 pr-2 text-center">일급</th>
          <th className="py-1.5 pr-2 text-center">비고</th>
          <th className="py-1.5 text-center print:hidden">관리</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, idx) => {
          if (item.kind === "gap") {
            return (
              <tr key={`gap-${idx}`} aria-hidden="true">
                <td colSpan={COLS} className="h-4 border-0 p-0" />
              </tr>
            );
          }
          if (item.kind === "subtotal") {
            return (
              <tr key={`subtotal-${idx}`} className="border-b-2 border-slate-300 bg-slate-50 font-semibold text-slate-800">
                <td colSpan={5} className="py-1.5 pr-2 text-center">
                  소계 ({item.days}일)
                </td>
                <td className="py-1.5 pr-2 text-center">{formatWon(item.amount)}</td>
                <td colSpan={2} className="py-1.5" />
              </tr>
            );
          }

          const r = item.row;
          const rowNo = rowNoById.get(r.id) ?? 0;

          if (editingId === r.id) {
            return (
              <tr key={r.id} className="border-b border-slate-200 bg-slate-50">
                <td colSpan={COLS} className="py-3 pr-2">
                  <form onSubmit={handleSaveEdit} className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="date" name="use_date" required defaultValue={r.use_date} className={inputClass} />
                    <select name="daily_worker_id" required defaultValue={r.daily_worker_id} className={inputClass}>
                      {workers.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      name="daily_wage"
                      defaultValue={r.daily_wage ?? ""}
                      placeholder="일급"
                      className={inputClass}
                    />
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
            );
          }

          return (
            <tr key={r.id} className="border-b border-slate-100 text-slate-700">
              <td className="py-1.5 pr-2 text-center">{rowNo}</td>
              <td className="py-1.5 pr-2 text-center">{formatDate(r.use_date)}</td>
              <td className="py-1.5 pr-2 text-center">
                {r.name}{" "}
                <span
                  className={
                    item.monthlyCount > MONTHLY_DAY_LIMIT
                      ? "text-[10px] font-semibold text-red-600"
                      : "text-[10px] text-slate-400"
                  }
                >
                  {item.monthlyCount}일째
                </span>
              </td>
              <td className="py-1.5 pr-2 text-center">{r.resident_id_masked ?? "-"}</td>
              <td className="py-1.5 pr-2 text-center">{r.phone ?? "-"}</td>
              <td className="py-1.5 pr-2 text-center">{r.daily_wage != null ? formatWon(r.daily_wage) : "-"}</td>
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
          );
        })}
        {items.length === 0 && (
          <tr>
            <td colSpan={COLS} className="py-6 text-center text-slate-400">
              해당 월의 사용내역이 없습니다.
            </td>
          </tr>
        )}
      </tbody>
      {rows.length > 0 && (
        <tfoot>
          <tr className="border-t-2 border-slate-900 font-semibold text-slate-900">
            <td colSpan={5} className="py-2 text-center">
              전체 합계 ({rows.length}건)
            </td>
            <td className="py-2 text-center">{formatWon(total)}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      )}
    </table>
  );
}
