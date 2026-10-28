import { test } from "node:test";
import assert from "node:assert/strict";
import { collapseBulkChanges, describeChanges, summarizeHistoryTx, type HistoryNames, type HistoryTx } from "@/lib/transactionHistory";

// 가짜 이름표·거래(실제 회사 자료 아님)
const names: HistoryNames = {
  clients: new Map([["c1", "가짜 철물점"], ["c2", "가짜 자재상"]]),
  projects: new Map([["p1", "가짜 현장 A"], ["p2", "가짜 현장 B"]]),
  categories: new Map([["k1", "원자재"]]),
  paymentMethods: new Map([["m1", "가짜 카드"]]),
};
const base: HistoryTx = {
  trans_date: "2026-10-10",
  type: "매입",
  client_id: "c1",
  client_name_raw: null,
  project_id: "p1",
  category_id: "k1",
  payment_method_id: "m1",
  payment_type: "immediate",
  item_name: "가짜 철판",
  quantity: 2,
  unit_price: 300_000,
  purchase_amount: 600_000,
  purchase_vat: 60_000,
  sales_amount: 0,
  sales_vat: 0,
  tax_invoice_issued: true,
  vat_included: true,
  needs_classification: false,
  note1: null,
  note2: null,
  payment_group_id: null,
};

test("수정 이력: 바뀐 칸만 '전 → 후'로(이름은 이름표로)", () => {
  const after = { ...base, project_id: "p2", purchase_amount: 700_000, purchase_vat: 70_000, note1: "가짜 메모" };
  assert.deepEqual(describeChanges(base, after, names), [
    { label: "프로젝트", before: "가짜 현장 A", after: "가짜 현장 B" },
    { label: "금액(합계)", before: "660,000원", after: "770,000원" },
    { label: "비고1", before: "-", after: "가짜 메모" },
  ]);
});

test("수정 이력: 합계가 같고 공급가·부가세만 바뀌면 그 줄, 아무것도 안 바뀌면 빈 목록", () => {
  const split = { ...base, purchase_amount: 660_000, purchase_vat: 0, vat_included: false };
  assert.deepEqual(describeChanges(base, split, names), [
    { label: "공급가·부가세", before: "600,000원 + 60,000원", after: "660,000원 + 0원" },
    { label: "10% VAT 추가", before: "체크", after: "해제" },
  ]);
  assert.deepEqual(describeChanges(base, { ...base }, names), []);
});

test("수정 이력: 거래처를 직접 입력으로 바꾸거나 일반경비·외상·묶음으로 바뀐 것", () => {
  const after = { ...base, client_id: null, client_name_raw: "가짜 식당", project_id: null, payment_type: "credit", payment_group_id: "g1" };
  assert.deepEqual(
    describeChanges(base, after, names).map((c) => `${c.label}: ${c.before} → ${c.after}`),
    ["거래처: 가짜 철물점 → 가짜 식당", "프로젝트: 가짜 현장 A → 일반경비", "결제방식: 즉시결제 → 외상", "한 결제 묶음: 없음 → 묶음"]
  );
});

test("수정 이력 요약: 날짜·거래처·품목·합계(매출은 매출 금액)", () => {
  assert.deepEqual(summarizeHistoryTx(base, names), { date: "2026-10-10", type: "매입", client: "가짜 철물점", item: "가짜 철판", total: 660_000 });
  const sale = { ...base, type: "매출", sales_amount: 1_000_000, sales_vat: 100_000, client_id: "없는 거래처", client_name_raw: "가짜 발주처" };
  assert.deepEqual(summarizeHistoryTx(sale, names).total, 1_100_000);
  assert.equal(summarizeHistoryTx(sale, names).client, "가짜 발주처");
});

test("수정 이력 접기: 같은 사람·같은 시각·같은 구분이 20건 이상이면 한 묶음, 적으면 한 건씩(최근 순 유지)", () => {
  let id = 0;
  const entry = (action: string, changed_at: string, changed_by: string | null = "u1") => ({ id: ++id, action, changed_at, changed_by });
  const restoreAt = "2026-10-28T01:00:00.123456+00:00";
  const restore = Array.from({ length: 25 }, () => entry("delete", restoreAt));
  const newer = entry("update", "2026-10-28T02:00:00+00:00");
  const fewDeletes = Array.from({ length: 3 }, () => entry("delete", "2026-10-27T05:00:00+00:00"));
  const otherPerson = entry("delete", restoreAt, "u2");
  const items = collapseBulkChanges([newer, ...restore.slice(0, 10), otherPerson, ...restore.slice(10), ...fewDeletes]);
  assert.deepEqual(
    items.map((list) => list.length),
    [1, 25, 1, 1, 1, 1]
  );
  assert.equal(items[1][0].id, restore[0].id);
  assert.equal(items[2][0].changed_by, "u2");
  // 같은 시각이라도 수정·삭제는 따로 셈
  const mixed = [...Array.from({ length: 19 }, () => entry("update", restoreAt)), entry("delete", restoreAt)];
  assert.equal(collapseBulkChanges(mixed).length, 20);
});
