// 매입매출 "챙길 거래" 창(11/11 사용자 요청 "매입장에서 체크하면 메모 아래 작은 창에 바로 올라가 보이고, 필요 없으면 쉽게 지우게",
// 105 SQL transaction_watch, 사용자 결정 "모든 기기 공용" + "줄마다 짧은 메모") — 창에 보일 줄 만들기·순서·접기·메모 다듬기.
// 저장은 lib/actions/transactionWatch.ts, 불러오기는 lib/transactionWatchLoad.ts, 화면은 components/TransactionWatchPanel.tsx.
// 거래·금액은 바꾸지 않음(창에만 쓰는 표시). 검사: transactionWatch.test.ts
import { groupLedgerRows, summaryLabel } from "@/lib/paymentGroup";

export const WATCH_MEMO_MAX = 100;
// 이보다 많으면 나머지는 "N건 더 보기"로 접음(창이 길어져 장부가 너무 아래로 밀리지 않게)
export const WATCH_VISIBLE = 10;

/** 창 한 줄에 필요한 거래 내용(불러올 때 이름표까지 붙여 둠) */
export type WatchTx = {
  id: string;
  trans_date: string;
  type: string;
  item_name: string | null;
  client_name: string;
  project_name: string | null;
  amount: number;
  payment_group_id: string | null;
};

/** transaction_watch 한 줄 + 그 거래 */
export type WatchRow = { id: string; transaction_id: string; memo: string | null; created_at: string; tx: WatchTx };

/** 창에 보이는 한 줄 — 한 결제로 묶인 거래를 같이 올렸으면 매입장처럼 한 줄(금액 합계, "A 외 1곳") */
export type WatchEntry = {
  key: string;
  transactionIds: string[];
  date: string;
  type: string;
  client: string;
  item: string;
  project: string | null;
  amount: number;
  memo: string;
  watchedAt: string;
};

/** 메모 다듬기 — 앞뒤 공백 빼고 100자까지, 비면 null */
export function normalizeWatchMemo(memo: string | null | undefined): string | null {
  const text = (memo ?? "").trim().slice(0, WATCH_MEMO_MAX).trim();
  return text || null;
}

/** 창의 줄 — 최근에 올린 것이 위(같으면 거래일 최신순) */
export function buildWatchEntries(rows: WatchRow[]): WatchEntry[] {
  const byTx = new Map(rows.map((r) => [r.transaction_id, r]));
  const txs = rows.map((r) => r.tx);
  const entries = groupLedgerRows(txs).map((item): WatchEntry => {
    const lines = item.lines;
    const watch = lines.map((l) => byTx.get(l.id)!).sort((a, b) => a.created_at.localeCompare(b.created_at));
    return {
      key: item.key,
      transactionIds: lines.map((l) => l.id),
      date: lines.map((l) => l.trans_date).sort().at(-1) ?? "",
      type: lines[0].type,
      client: summaryLabel(lines.map((l) => l.client_name || "-"), "곳"),
      item: summaryLabel(lines.map((l) => l.item_name ?? "-"), "건"),
      project: lines.some((l) => l.project_name) ? summaryLabel(lines.map((l) => l.project_name ?? "일반경비"), "곳") : null,
      amount: lines.reduce((s, l) => s + l.amount, 0),
      memo: watch.map((w) => w.memo ?? "").find(Boolean) ?? "",
      watchedAt: watch.at(-1)?.created_at ?? "",
    };
  });
  return entries.sort((a, b) => b.watchedAt.localeCompare(a.watchedAt) || b.date.localeCompare(a.date));
}

/** 처음 보이는 줄과 접힌 줄 수 — 펼쳤으면 전부 */
export function visibleWatchEntries<T>(entries: T[], expanded: boolean, limit = WATCH_VISIBLE): { shown: T[]; hidden: number } {
  if (expanded || entries.length <= limit) return { shown: entries, hidden: 0 };
  return { shown: entries.slice(0, limit), hidden: entries.length - limit };
}

/**
 * 매입장 줄의 📌 — 묶음 줄은 묶음의 모든 거래. 하나라도 올라가 있으면 📌가 켜진 것으로 보고 누르면 모두 내림, 아니면 모두 올림.
 */
export function watchToggle(ids: string[], watched: Set<string>): { on: boolean; action: "watch" | "unwatch" } {
  const on = ids.some((id) => watched.has(id));
  return { on, action: on ? "unwatch" : "watch" };
}
