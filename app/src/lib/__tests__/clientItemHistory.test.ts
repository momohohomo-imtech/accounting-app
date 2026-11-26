import { test } from "node:test";
import assert from "node:assert/strict";
import { clientItemSuggestions, itemKey, suggestionLabel } from "@/lib/clientItemHistory";

// 가짜 품목만
test("같은 품목은 한 줄로, 최근에 쓴 순, 이름은 가장 최근에 적은 그대로", () => {
  const s = clientItemSuggestions([
    { item_name: "가짜 볼트", trans_date: "2026-10-01", unit_price: 4000 },
    { item_name: "가짜 너트", trans_date: "2026-11-05", unit_price: null },
    { item_name: " 가짜  볼트 ", trans_date: "2026-11-20", unit_price: 5000 },
    { item_name: "가짜 장갑", trans_date: "2026-09-15", unit_price: 1200 },
  ]);
  assert.deepEqual(
    s.map((x) => [x.name, x.lastDate, x.count, x.unitPrice]),
    [
      ["가짜 볼트", "2026-11-20", 2, 5000],
      ["가짜 너트", "2026-11-05", 1, null],
      ["가짜 장갑", "2026-09-15", 1, 1200],
    ]
  );
});

test("같은 날은 나중에 등록한 것이 먼저, 빈 품목은 뺌, 단가는 최근 것이 없으면 그 전 것", () => {
  const s = clientItemSuggestions([
    { item_name: "가짜 A", trans_date: "2026-11-20", created_at: "2026-11-20T01:00:00Z", unit_price: null },
    { item_name: "가짜 B", trans_date: "2026-11-20", created_at: "2026-11-20T03:00:00Z", unit_price: 100 },
    { item_name: "", trans_date: "2026-11-21", unit_price: 1 },
    { item_name: null, trans_date: "2026-11-22", unit_price: 1 },
    { item_name: "가짜 a", trans_date: "2026-10-01", unit_price: 700 },
  ]);
  assert.deepEqual(s.map((x) => x.name), ["가짜 B", "가짜 A"]);
  assert.equal(s[1].unitPrice, 700, "최근 줄에 단가가 없으면 그 전 줄의 단가");
  assert.equal(s[1].count, 2, "영문 대소문자는 같은 품목");
});

test("개수 한도·열쇠·글자", () => {
  const many = Array.from({ length: 60 }, (_, i) => ({ item_name: `가짜 품목 ${i}`, trans_date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}` }));
  assert.equal(clientItemSuggestions(many).length, 40);
  assert.equal(clientItemSuggestions(many, 5).length, 5);
  assert.equal(itemKey("  Gaja   Bolt "), "gaja bolt");
  assert.equal(suggestionLabel({ name: "가짜", lastDate: "2026-11-05", count: 3, unitPrice: 5000 }), "11/5 · 3번 · 단가 5,000원");
  assert.equal(suggestionLabel({ name: "가짜", lastDate: "2026-01-20", count: 1, unitPrice: null }), "1/20 · 1번");
});
