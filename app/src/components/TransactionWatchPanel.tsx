"use client";

import { useState } from "react";
import Link from "next/link";
import { formatWon } from "@/lib/format";
import { ledgerEditHref, type LedgerListParams } from "@/lib/ledgerLinks";
import {
  UNWATCH_CONFIRM,
  unwatchConfirmMessage,
  visibleWatchEntries,
  watchDateLabel,
  watchLabel,
  WATCH_MEMO_MAX,
  WATCH_VISIBLE,
  type WatchEntry,
} from "@/lib/transactionWatch";
import { unwatchTransactions, updateTransactionWatchMemo } from "@/lib/actions/transactionWatch";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { isLeaveDialogFocus, useUnsavedGuard } from "@/components/UnsavedChangesProvider";

// 메모칸은 남은 폭 전부(11/26 사용자 "금액을 옆으로, 메모 내용이 길게 보이게" — 예전엔 폭 11rem이라 긴 메모가 잘렸음)
const memoInputClass =
  "min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10";

// 매입매출 "챙길 거래" 창(11/11, 105 SQL transaction_watch) — 메모칸 바로 아래. 매입장 📌로 올린 거래가 바로 보이고 ×로 빠짐(거래는
// 그대로, 빼기 전 확인창 — 11/12 사용자 요청). 달·필터를 바꿔도 그대로, 내용만큼 늘고 줄고(비면 안 보임), 10건 넘으면 "N건 더 보기".
// 줄을 누르면 그 거래 수정 화면, 줄마다 짧은 메모(입력칸에서 벗어나면 저장 — 매입매출 메모칸과 같게). 조회 전용 계정은 보기만.
// 계산은 lib/transactionWatch.ts.
export function TransactionWatchPanel({
  entries,
  listParams,
  canEdit,
  error,
  currentYear,
}: {
  entries: WatchEntry[];
  listParams: LedgerListParams;
  canEdit: boolean;
  error: string | null;
  currentYear: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { shown, hidden } = visibleWatchEntries(entries, expanded);

  if (error) {
    return <p className="text-xs text-red-600 print:hidden">챙길 거래를 불러오지 못했습니다: {error}</p>;
  }
  if (entries.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 print:hidden">
      <p className="text-xs font-semibold text-amber-900">📌 챙길 거래 {entries.length.toLocaleString("ko-KR")}건</p>
      <ul className="mt-1 divide-y divide-amber-100">
        {shown.map((entry) => (
          <WatchLine
            // 메모가 다른 기기에서 바뀌어 새로 그려지면 입력칸도 새 메모로
            key={`${entry.key}|${entry.memo}`}
            entry={entry}
            href={ledgerEditHref(listParams, entry.transactionIds[0])}
            canEdit={canEdit}
            currentYear={currentYear}
            onError={setActionError}
          />
        ))}
      </ul>
      {entries.length > WATCH_VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs text-amber-800 underline decoration-amber-300 underline-offset-2 hover:text-amber-950"
        >
          {expanded ? "접기" : `${hidden.toLocaleString("ko-KR")}건 더 보기`}
        </button>
      )}
      {actionError && <p className="mt-1 text-xs text-red-600">{actionError}</p>}
    </div>
  );
}

function WatchLine({
  entry,
  href,
  canEdit,
  currentYear,
  onError,
}: {
  entry: WatchEntry;
  href: string;
  canEdit: boolean;
  currentYear: number;
  onError: (message: string | null) => void;
}) {
  const pending = useGlobalPending();
  const confirm = useConfirm();
  const [memo, setMemo] = useState(entry.memo);
  const [lastSaved, setLastSaved] = useState(entry.memo);
  const [saving, setSaving] = useState(false);
  const dateLabel = watchDateLabel(entry.date, currentYear);
  const label = watchLabel(entry);

  function formData() {
    const fd = new FormData();
    entry.transactionIds.forEach((id) => fd.append("transaction_ids", id));
    return fd;
  }

  // 저장됐으면 true — 입력칸에서 벗어나면 저장, 쓰는 중에 화면을 떠나면 저장할지 물어봄(useUnsavedGuard)
  async function saveMemo(): Promise<boolean> {
    if (memo.trim() === lastSaved.trim()) return true;
    const fd = formData();
    fd.append("memo", memo);
    setSaving(true);
    const result = await pending.run(() => updateTransactionWatchMemo(fd));
    setSaving(false);
    if (result?.error) {
      onError(result.error);
      return false;
    }
    onError(null);
    setLastSaved(memo);
    return true;
  }

  useUnsavedGuard({
    dirty: canEdit && memo.trim() !== lastSaved.trim() && !saving,
    value: memo,
    label: `챙길 거래 메모(${label})`,
    save: saveMemo,
    discard: () => setMemo(lastSaved),
  });

  async function remove() {
    // 잘못 눌러 메모째 사라지지 않게 — 무엇을 빼는지·메모도 지워짐을 보여 주고 확인(매입장 📌 끄기와 같은 문구)
    if (!(await confirm(unwatchConfirmMessage({ ...entry, memo }, currentYear), UNWATCH_CONFIRM))) return;
    const result = await pending.run(() => unwatchTransactions(formData()));
    onError(result?.error ?? null);
  }

  // 줄 배치: 휴대폰은 거래·금액 한 줄 + 메모 아래 줄. sm부터는 거래(날짜·이름, 폭 1/3) → 금액(줄마다 같은 자리) → 메모칸(남은 폭 전부)
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5">
      <Link
        href={href}
        title={`${label}${entry.project ? ` · ${entry.project}` : ""} — 누르면 거래 수정`}
        className="flex min-w-0 flex-1 items-baseline gap-2 text-sm text-slate-800 hover:underline sm:w-1/3 sm:flex-none"
      >
        <span className="shrink-0 tabular-nums text-xs text-slate-500">{dateLabel}</span>
        {entry.type === "매출" && (
          <span className="shrink-0 rounded bg-brand-soft px-1 text-[10px] font-medium text-brand-dark">매출</span>
        )}
        <span className="truncate">{label}</span>
      </Link>
      <span className="shrink-0 whitespace-nowrap text-sm font-medium tabular-nums text-slate-900 sm:min-w-[7.5rem] sm:text-right">
        {formatWon(entry.amount)}
      </span>
      {canEdit ? (
        <div className="flex basis-full items-center gap-1 sm:min-w-0 sm:flex-1 sm:basis-auto">
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            onBlur={(e) => {
              if (isLeaveDialogFocus(e.relatedTarget)) return;
              void saveMemo();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) e.currentTarget.blur();
            }}
            maxLength={WATCH_MEMO_MAX}
            placeholder="메모(예: 현장 도착 확인)"
            aria-label={`${label} 메모`}
            className={memoInputClass}
          />
          <button
            type="button"
            onClick={remove}
            aria-label={`${label} 챙길 거래에서 빼기`}
            title="창에서 빼기(거래는 그대로)"
            className="shrink-0 rounded px-1.5 text-base leading-none text-slate-400 hover:bg-amber-100 hover:text-red-600"
          >
            ×
          </button>
        </div>
      ) : (
        entry.memo && <span className="basis-full text-xs text-slate-600 sm:min-w-0 sm:flex-1 sm:basis-auto">{entry.memo}</span>
      )}
    </li>
  );
}
