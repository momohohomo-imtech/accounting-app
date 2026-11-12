import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  UNWATCH_CONFIRM,
  WATCH_MEMO_MAX,
  WATCH_VISIBLE,
  buildWatchEntries,
  normalizeWatchMemo,
  unwatchConfirmMessage,
  visibleWatchEntries,
  watchDateLabel,
  watchLabel,
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

test("창 줄 날짜·이름: 올해면 월-일만, 거래처가 비면 -", () => {
  assert.equal(watchDateLabel("2026-11-05", 2026), "11-05");
  assert.equal(watchDateLabel("2025-12-30", 2026), "2025-12-30");
  assert.equal(watchLabel({ client: "가짜상사", item: "가짜 품목" }), "가짜상사 · 가짜 품목");
  assert.equal(watchLabel({ client: "", item: "가짜 품목" }), "- · 가짜 품목");
});

test("빼기 확인 문구: 무엇을 빼는지 + 거래는 그대로 + 메모도 지워짐(11/12 사용자 요청)", () => {
  const entry = { date: "2026-11-05", type: "매입", client: "가짜상사", item: "가짜 품목", amount: 1234000, memo: "  가짜 현장 도착 확인 " };
  assert.equal(
    unwatchConfirmMessage(entry, 2026),
    "11-05 가짜상사 · 가짜 품목 1,234,000원\n\n창에서만 빠지고 거래는 매입매출장에 그대로 남습니다.\n적어 둔 메모 \"가짜 현장 도착 확인\"도 같이 지워집니다."
  );
  // 메모가 없으면 메모 줄 없음, 매출은 [매출] 표시, 지난해는 연도까지
  const sale = unwatchConfirmMessage({ ...entry, type: "매출", memo: "   ", date: "2025-12-30" }, 2026);
  assert.equal(sale, "2025-12-30 [매출] 가짜상사 · 가짜 품목 1,234,000원\n\n창에서만 빠지고 거래는 매입매출장에 그대로 남습니다.");
  // 어떤 줄인지 모르면 안내만
  assert.equal(
    unwatchConfirmMessage(null, 2026),
    "창에서만 빠지고 거래는 매입매출장에 그대로 남습니다.\n적어 둔 메모가 있으면 같이 지워집니다."
  );
  // 확인창은 빨간 "빼기" 버튼
  assert.deepEqual(UNWATCH_CONFIRM, { title: "챙길 거래에서 빼기", confirmLabel: "빼기", danger: true });
});

test("빼기 확인 문구: 묶음 줄은 창과 같은 한 줄(\"외 1곳\"·합계 금액)", () => {
  const [entry] = buildWatchEntries([
    row("a", { payment_group_id: "g1", client_name: "가짜상사", amount: 1000 }, { memo: "가짜 메모" }),
    row("b", { payment_group_id: "g1", client_name: "가짜자재", amount: 2000 }),
  ]);
  const message = unwatchConfirmMessage(entry, 2026);
  // "외 1곳"은 줄바꿈 안 되는 빈칸(summaryLabel)
  assert.match(message.split("\n")[0], /^10-01 가짜상사 외\s1곳 · .+ 3,000원$/);
  assert.ok(message.endsWith('적어 둔 메모 "가짜 메모"도 같이 지워집니다.'));
});

