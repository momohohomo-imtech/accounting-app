"use client";

import { Fragment, useMemo, useState } from "react";
import { cx } from "@/lib/cx";
import { formatDate, formatWon } from "@/lib/format";
import { updateDailyWorkerUsageLogRecord, deleteDailyWorkerUsageLogRecord } from "@/lib/actions/daily-worker-usage-logs";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

export type StatementRow = {
  id: string;
  use_date: string;
  daily_worker_id: string;
  name: string;
  resident_id: string | null;
  phone: string | null;
  daily_wage: number | null;
  note: string | null;
  site_id: string | null;
  site_name: string | null;
};

type BlockRow = StatementRow & { monthlyCount: number };

export type StatementBlock = { id: string; siteName: string; rows: BlockRow[]; amount: number; days: number };

type WorkerOption = { id: string; name: string };
type SiteOption = { id: string; name: string };

const NO_SITE_LABEL = "현장 미지정";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
// 한 사람당 한 달 최대 사용일수 — 이 날짜를 넘어가면(8일째부터) 카운트를 빨간 글씨로 경고.
export const MONTHLY_DAY_LIMIT = 7;

export function blockDateLabel(block: StatementBlock) {
  const first = block.rows[0];
  const last = block.rows[block.rows.length - 1];
  return block.rows.length > 1 ? `${formatDate(first.use_date)} ~ ${formatDate(last.use_date)}` : formatDate(first.use_date);
}

// 현장의 날짜가 하루 간격 이내로 이어지면(같은 날 여러 근로자 포함) 한 블록으로 묶어 소계를 낸다.
// 블록이 바뀌는 지점(다른 현장으로 넘어가거나 날짜가 끊길 때)마다 새 블록이 시작된다.
export function buildStatementBlocks(rows: StatementRow[]): StatementBlock[] {
  const byWorker = new Map<string, StatementRow[]>();
  const bySite = new Map<string, StatementRow[]>();
  for (const r of rows) {
    const workerList = byWorker.get(r.daily_worker_id) ?? [];
    workerList.push(r);
    byWorker.set(r.daily_worker_id, workerList);

    const siteKey = r.site_id ?? "__none__";
    const siteList = bySite.get(siteKey) ?? [];
    siteList.push(r);
    bySite.set(siteKey, siteList);
  }

  // 근로자별로 이번 달 몇 번째 사용일인지(연속 여부와 무관하게 월 전체 누적) 미리 계산.
  const monthlyCountByRowId = new Map<string, number>();
  for (const list of byWorker.values()) {
    const sorted = [...list].sort((a, b) => a.use_date.localeCompare(b.use_date));
    sorted.forEach((r, i) => monthlyCountByRowId.set(r.id, i + 1));
  }

  const blocks: StatementBlock[] = [];
  for (const group of bySite.values()) {
    // 같은 날짜끼리는 이름을 가나다순으로 정렬.
    const sorted = [...group].sort(
      (a, b) => a.use_date.localeCompare(b.use_date) || a.name.localeCompare(b.name, "ko")
    );
    let run: StatementRow[] = [];
    let runLastDate = "";

    const flushRun = () => {
      if (run.length === 0) return;
      const blockRows = run.map((r) => ({ ...r, monthlyCount: monthlyCountByRowId.get(r.id) ?? 1 }));
      const amount = run.reduce((s, r) => s + (r.daily_wage ?? 0), 0);
      const days = new Set(run.map((r) => r.use_date)).size;
      blocks.push({
        id: `${run[0].site_id ?? "none"}:${run[0].use_date}`,
        siteName: run[0].site_name ?? NO_SITE_LABEL,
        rows: blockRows,
        amount,
        days,
      });
      run = [];
    };

    sorted.forEach((r) => {
      if (run.length === 0) {
        run.push(r);
        runLastDate = r.use_date;
        return;
      }
      const diffDays = Math.round((new Date(r.use_date).getTime() - new Date(runLastDate).getTime()) / ONE_DAY_MS);
      if (diffDays <= 1) {
        run.push(r);
        runLastDate = r.use_date;
      } else {
        flushRun();
        run.push(r);
        runLastDate = r.use_date;
      }
    });
    flushRun();
  }

  // 현장과 무관하게, 블록의 마지막(가장 최근) 날짜 기준으로 최신이 위로 오게 정렬.
  blocks.sort((a, b) => {
    const aLast = a.rows[a.rows.length - 1].use_date;
    const bLast = b.rows[b.rows.length - 1].use_date;
    return bLast.localeCompare(aLast);
  });

  return blocks;
}

const inputClass = "w-full rounded-lg border border-slate-300 px-2 py-1 text-sm";
const COLS = 8;

export function DailyWorkerUsageStatementTable({
  rows,
  workers,
  sites,
}: {
  rows: StatementRow[];
  workers: WorkerOption[];
  sites: SiteOption[];
}) {
  const confirm = useConfirm();
  const pending = useGlobalPending();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [wageMultiplier, setWageMultiplier] = useState<1 | 1.5 | 2>(1);
  const [openBlocks, setOpenBlocks] = useState<Set<string>>(new Set());

  const blocks = useMemo(() => buildStatementBlocks(rows), [rows]);
  const rowNoById = useMemo(() => {
    const map = new Map<string, number>();
    let n = 0;
    for (const block of blocks) for (const r of block.rows) map.set(r.id, ++n);
    return map;
  }, [blocks]);
  const total = rows.reduce((s, r) => s + (r.daily_wage ?? 0), 0);

  function toggleBlock(id: string) {
    setOpenBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSaveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!(await confirm("수정 내용을 저장하시겠습니까?"))) return;
    const fd = new FormData(form);
    if (wageMultiplier !== 1) {
      const base = Number(fd.get("daily_wage") ?? 0);
      fd.set("daily_wage", String(base * wageMultiplier));
    }
    await pending.run(() => Promise.resolve(updateDailyWorkerUsageLogRecord(fd)));
    setEditingId(null);
    setWageMultiplier(1);
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
        {blocks.map((block) => {
          const open = openBlocks.has(block.id);
          return (
            <Fragment key={block.id}>
              {block.rows.map((r) => {
                const rowNo = rowNoById.get(r.id) ?? 0;
                const hiddenOnScreen = !open && "hidden print:table-row";

                if (editingId === r.id) {
                  return (
                    <tr key={r.id} className={cx("border-b border-slate-200 bg-slate-50", hiddenOnScreen)}>
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
                          <select name="site_id" defaultValue={r.site_id ?? ""} className={inputClass}>
                            <option value="">현장 선택</option>
                            {sites.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
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
                          <div className="flex items-center gap-3 px-1 text-xs text-slate-600">
                            <label className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={wageMultiplier === 1.5}
                                onChange={() => setWageMultiplier((m) => (m === 1.5 ? 1 : 1.5))}
                                className="h-4 w-4"
                              />
                              1.5배
                            </label>
                            <label className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={wageMultiplier === 2}
                                onChange={() => setWageMultiplier((m) => (m === 2 ? 1 : 2))}
                                className="h-4 w-4"
                              />
                              2배
                            </label>
                          </div>
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
                              onClick={() => {
                                setEditingId(null);
                                setWageMultiplier(1);
                              }}
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
                  <tr key={r.id} className={cx("border-b border-slate-100 text-slate-700", hiddenOnScreen)}>
                    <td className="py-1.5 pr-2 text-center">{rowNo}</td>
                    <td className="py-1.5 pr-2 text-center">{formatDate(r.use_date)}</td>
                    <td className="py-1.5 pr-2 text-center">
                      {r.name}{" "}
                      <span
                        className={
                          r.monthlyCount > MONTHLY_DAY_LIMIT
                            ? "text-[10px] font-semibold text-red-600"
                            : "text-[10px] text-slate-400"
                        }
                      >
                        {r.monthlyCount}일째
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 text-center">{r.resident_id ?? "-"}</td>
                    <td className="py-1.5 pr-2 text-center">{r.phone ?? "-"}</td>
                    <td className="py-1.5 pr-2 text-center">{r.daily_wage != null ? formatWon(r.daily_wage) : "-"}</td>
                    <td className="py-1.5 pr-2 text-center">{r.note ?? "-"}</td>
                    <td className="py-1.5 text-center print:hidden">
                      <div className="flex justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(r.id);
                            setWageMultiplier(1);
                          }}
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
              <tr className="border-b-2 border-slate-300 bg-slate-50 font-semibold text-slate-800">
                <td colSpan={COLS} className="py-1.5 pr-2">
                  <button
                    type="button"
                    onClick={() => toggleBlock(block.id)}
                    className="flex w-full items-center justify-between gap-2 text-left print:pointer-events-none"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-400 print:hidden">{open ? "▼" : "▶"}</span>
                      {block.siteName} · {blockDateLabel(block)} · 소계 ({block.days}일 · {block.rows.length}건)
                    </span>
                    <span>{formatWon(block.amount)}</span>
                  </button>
                </td>
              </tr>
              <tr aria-hidden="true">
                <td colSpan={COLS} className="h-4 border-0 p-0" />
              </tr>
            </Fragment>
          );
        })}
        {blocks.length === 0 && (
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
