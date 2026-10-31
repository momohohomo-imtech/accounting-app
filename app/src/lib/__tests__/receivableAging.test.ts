import { test } from "node:test";
import assert from "node:assert/strict";
import { receivableAging } from "@/lib/receivableAging";

// 가짜 외상매출(실제 자료 아님)
test("오래된 외상매출금: 거래일부터 지난 날로 30·60·90일 나눔, 잔액 0은 빼고, 오래된 것 먼저", () => {
  const r = receivableAging(
    [
      { id: "a", trans_date: "2026-10-31", client: "가짜 갑", item: null, amount: 100 },
      { id: "b", trans_date: "2026-10-01", client: "가짜 을", item: null, amount: 200 }, // 30일
      { id: "c", trans_date: "2026-09-30", client: "가짜 병", item: null, amount: 300 }, // 31일
      { id: "d", trans_date: "2026-08-02", client: "가짜 정", item: null, amount: 400 }, // 90일
      { id: "e", trans_date: "2026-08-01", client: "가짜 무", item: "가짜 품목", amount: 500 }, // 91일
      { id: "f", trans_date: "2025-01-01", client: "가짜 기", item: null, amount: 0 },
    ],
    "2026-10-31"
  );
  assert.deepEqual(
    r.buckets.map((b) => [b.label, b.count, b.amount]),
    [
      ["30일 이내", 2, 300],
      ["31~60일", 1, 300],
      ["61~90일", 1, 400],
      ["90일 초과", 1, 500],
    ]
  );
  assert.deepEqual(r.items.map((i) => [i.id, i.days]), [["e", 91], ["d", 90], ["c", 31], ["b", 30], ["a", 0]]);
  assert.deepEqual(r.over60.map((i) => i.id), ["e", "d"]);
});

test("오래된 외상매출금: 윤년·연도가 바뀌어도 날 수가 맞음, 앞날짜 거래는 0일", () => {
  const r = receivableAging(
    [
      { id: "leap", trans_date: "2028-02-28", client: "가짜", item: null, amount: 1 },
      { id: "future", trans_date: "2029-01-05", client: "가짜", item: null, amount: 1 },
    ],
    "2028-03-01"
  );
  assert.equal(r.items.find((i) => i.id === "leap")?.days, 2);
  assert.equal(r.items.find((i) => i.id === "future")?.days, 0);
});
