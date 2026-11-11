import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  WATCH_MEMO_MAX,
  WATCH_VISIBLE,
  buildWatchEntries,
  normalizeWatchMemo,
  visibleWatchEntries,
  watchToggle,
  type WatchRow,
} from "@/lib/transactionWatch";

// 가짜 자료만
function row(id: string, over: Partial<WatchRow["tx"]> = {}, watch: Partial<Omit<WatchRow, "tx">> = {}): WatchRow {
  return {
    id: `w-${id}`,
    transaction_id: id,
    memo: null,
    created_at: "2026-11-01T00:00:00Z",
    ...watch,
    tx: {
      id,
      trans_date: "2026-10-01",
      type: "매입",
      item_name: `가짜 품목 ${id}`,
      client_name: "가짜상사",
      project_name: null,
      amount: 1000,
      payment_group_id: null,
      ...over,
    },
  };
}

test("메모 다듬기: 앞뒤 공백·빈 값·100자까지", () => {
  assert.equal(normalizeWatchMemo("  현장 도착 확인 "), "현장 도착 확인");
  assert.equal(normalizeWatchMemo("   "), null);
  assert.equal(normalizeWatchMemo(null), null);
  assert.equal(normalizeWatchMemo("가".repeat(150))?.length, WATCH_MEMO_MAX);
});

test("창의 줄: 최근에 올린 것이 위, 같은 시각이면 거래일 최신순", () => {
  const entries = buildWatchEntries([
    row("a", { trans_date: "2026-10-05" }, { created_at: "2026-11-01T01:00:00Z" }),
    row("b", { trans_date: "2026-09-01" }, { created_at: "2026-11-02T01:00:00Z" }),
    row("c", { trans_date: "2026-10-09" }, { created_at: "2026-11-01T01:00:00Z" }),
  ]);
  assert.deepEqual(
    entries.map((e) => e.key),
    ["b", "c", "a"]
  );
  assert.deepEqual(entries[0].transactionIds, ["b"]);
});

test("한 결제 묶음을 같이 올리면 한 줄 — 금액 합계, 'A 외 1곳', 메모는 먼저 적힌 것, 날짜는 마지막", () => {
  const g = "pg-1";
  const entries = buildWatchEntries([
    row("x1", { payment_group_id: g, amount: 300, client_name: "가짜상사", item_name: "가짜 볼트", trans_date: "2026-10-01" }, { memo: null }),
    row(
      "x2",
      { payment_group_id: g, amount: 700, client_name: "가짜철강", item_name: "가짜 너트", project_name: "가짜 현장 A", trans_date: "2026-10-03" },
      { memo: "반품 예정", created_at: "2026-11-03T00:00:00Z" }
    ),
    row("y", { payment_group_id: "pg-2", amount: 50 }),
  ]);
  const group = entries.find((e) => e.key === `group:${g}`);
  assert.ok(group);
  assert.deepEqual(group.transactionIds, ["x1", "x2"]);
  assert.equal(group.amount, 1000);
  assert.equal(group.client, "가짜상사 외 1곳");
  assert.equal(group.item, "가짜 볼트 외 1건");
  assert.equal(group.project, "일반경비 외 1곳");
  assert.equal(group.memo, "반품 예정");
  assert.equal(group.date, "2026-10-03");
  assert.equal(group.watchedAt, "2026-11-03T00:00:00Z");
  // 묶음에서 한 줄만 올렸으면 그 줄만
  assert.deepEqual(entries.find((e) => e.key === "y")?.transactionIds, ["y"]);
});

test("10건 넘으면 나머지는 접기, 펼치면 전부", () => {
  const list = Array.from({ length: 13 }, (_, i) => i);
  assert.equal(WATCH_VISIBLE, 10);
  assert.deepEqual(visibleWatchEntries(list, false), { shown: list.slice(0, 10), hidden: 3 });
  assert.deepEqual(visibleWatchEntries(list, true), { shown: list, hidden: 0 });
  assert.deepEqual(visibleWatchEntries(list.slice(0, 10), false), { shown: list.slice(0, 10), hidden: 0 });
});

test("📌: 하나라도 올라가 있으면 켜짐 → 누르면 모두 내림, 아니면 모두 올림", () => {
  const watched = new Set(["a"]);
  assert.deepEqual(watchToggle(["a"], watched), { on: true, action: "unwatch" });
  assert.deepEqual(watchToggle(["b", "c"], watched), { on: false, action: "watch" });
  assert.deepEqual(watchToggle(["a", "b"], watched), { on: true, action: "unwatch" });
});

test("105 SQL: 메모 100자 제한이 앱과 같음, 거래 하나에 한 줄", () => {
  const sql = readFileSync(new URL("../../../../supabase/105_transaction_watch.sql", import.meta.url), "utf8");
  assert.ok(sql.includes(`char_length(memo) <= ${WATCH_MEMO_MAX}`));
  assert.match(sql, /transaction_id\s+uuid not null unique references public\.transactions\(id\) on delete cascade/);
});
