import { test } from "node:test";
import assert from "node:assert/strict";
import { findDuplicateCandidates, taxFinanceKind, uncategorizedPurchases, type LedgerCheckRow } from "@/lib/ledgerCheck";

// 가짜 거래(실제 회사 자료 아님)
let seq = 0;
const tx = (date: string, total: number, extra: Partial<LedgerCheckRow> = {}): LedgerCheckRow => ({
  id: `t${++seq}`,
  trans_date: date,
  type: "매입",
  client_id: "c1",
  client_name_raw: null,
  clients: { name: "가짜 상점" },
  item_name: "가짜 음료",
  note1: null,
  category_id: "k1",
  payment_group_id: null,
  sales_amount: 0,
  sales_vat: 0,
  purchase_amount: total,
  purchase_vat: 0,
  ...extra,
});

test("중복 의심: 같은 날·구분·거래처·품목·금액이 2건 이상이면 한 묶음으로", () => {
  const a = tx("2026-09-03", 11_000);
  const b = tx("2026-09-03", 11_000, { item_name: " 가짜  음료 " }); // 띄어쓰기만 다름 — 같은 품목
  const otherDay = tx("2026-09-04", 11_000);
  const otherAmount = tx("2026-09-03", 12_000);
  const otherItem = tx("2026-09-03", 11_000, { item_name: "가짜 식사" });
  const groups = findDuplicateCandidates([a, otherDay, b, otherAmount, otherItem]);
  assert.deepEqual(
    groups.map((g) => [g.date, g.client, g.total, g.rows.map((r) => r.id)]),
    [["2026-09-03", "가짜 상점", 11_000, [a.id, b.id]]]
  );
});

test("중복 의심: 한 결제로 묶은 줄끼리는 일부러 나눈 것이라 빼고, 0원·매입/매출 다른 것도 뺌", () => {
  const g1 = tx("2026-10-10", 55_000, { payment_group_id: "G1" });
  const g2 = tx("2026-10-10", 55_000, { payment_group_id: "G1" });
  const zero1 = tx("2026-10-11", 0);
  const zero2 = tx("2026-10-11", 0);
  const sale = tx("2026-10-12", 33_000, { type: "매출", purchase_amount: 0, sales_amount: 33_000 });
  const buy = tx("2026-10-12", 33_000);
  assert.deepEqual(findDuplicateCandidates([g1, g2, zero1, zero2, sale, buy]), []);
  // 묶음 밖에 같은 줄이 하나 더 있으면 의심
  const loose = tx("2026-10-10", 55_000);
  assert.deepEqual(findDuplicateCandidates([g1, g2, loose]).map((g) => g.rows.length), [3]);
});

test("중복 의심: 거래처를 직접 입력한 거래는 이름으로 비교, 최근 날짜가 먼저", () => {
  const raw = (date: string, name: string) => tx(date, 5_500, { client_id: null, clients: null, client_name_raw: name });
  const groups = findDuplicateCandidates([raw("2026-08-01", "가짜 식당"), raw("2026-08-01", "가짜식당"), raw("2026-09-01", "가짜 식당"), raw("2026-09-01", "가짜 식당")]);
  assert.deepEqual(groups.map((g) => g.date), ["2026-09-01", "2026-08-01"]);
});

test("세금·보험·금융으로 보이는 글자: 세금계산서·부가세 포함 같은 말은 세금이 아님", () => {
  const k = (item_name: string, extra: Partial<LedgerCheckRow> = {}) => taxFinanceKind(tx("2026-09-01", 1, { item_name, ...extra }));
  assert.equal(k("9월 근로소득세"), "세금");
  assert.equal(k("지방세 납부"), "세금");
  assert.equal(k("국민연금 9월분"), "보험");
  assert.equal(k("어음 할인료"), "금융");
  assert.equal(k("가짜 자재", { clients: { name: "가짜 세무서" } }), "세금");
  assert.equal(k("가짜 자재(세금계산서 발행)"), null);
  assert.equal(k("가짜 자재 부가세 포함"), null);
  assert.equal(k("가짜 음료"), null);
});

test("카테고리 빈 매입: 매출·카테고리 있는 매입은 빼고, 세금·금융으로 보이는 것을 앞에", () => {
  const plain = tx("2026-10-01", 1_000, { category_id: null, item_name: "가짜 소모품" });
  const tax = tx("2026-09-01", 2_000, { category_id: null, item_name: "가짜 소득세" });
  const categorized = tx("2026-10-02", 3_000, { item_name: "가짜 소득세" });
  const sale = tx("2026-10-03", 4_000, { category_id: null, type: "매출", purchase_amount: 0, sales_amount: 4_000 });
  assert.deepEqual(
    uncategorizedPurchases([plain, tax, categorized, sale]).map((t) => [t.id, t.kind]),
    [
      [tax.id, "세금"],
      [plain.id, null],
    ]
  );
});
