import { test } from "node:test";
import assert from "node:assert/strict";
import { groupLedgerRows, summaryLabel, sameCommonFields, sortGroupLines } from "@/lib/paymentGroup";

// 가짜 거래 — 같은 payment_group_id는 한 결제를 프로젝트별로 나눈 줄
const row = (id: string, payment_group_id: string | null = null) => ({ id, payment_group_id });

test("매입장 묶기: 같은 묶음은 처음 나온 자리에 한 덩어리로, 나머지 순서는 그대로", () => {
  const rows = [row("a"), row("g1-x", "G1"), row("b"), row("g1-y", "G1"), row("c")];
  const items = groupLedgerRows(rows);
  assert.deepEqual(
    items.map((i) => [i.groupId, i.lines.map((l) => l.id)]),
    [
      [null, ["a"]],
      ["G1", ["g1-x", "g1-y"]],
      [null, ["b"]],
      [null, ["c"]],
    ]
  );
});

test("매입장 묶기: 화면에 한 줄만 보이는 묶음(프로젝트 필터 등)과 묶음 번호 없는 거래는 그냥 한 줄", () => {
  const items = groupLedgerRows([row("g2-x", "G2"), row("d", null), { id: "e" }]);
  assert.deepEqual(
    items.map((i) => [i.key, i.groupId, i.lines.length]),
    [
      ["g2-x", null, 1],
      ["d", null, 1],
      ["e", null, 1],
    ]
  );
});

test("묶음 안 줄 순서: 프로젝트 이름 → 품목 이름, 일반경비(프로젝트 없음)는 맨 뒤", () => {
  const line = (item_name: string, project: string | null) => ({ item_name, projects: project ? { name: project } : null });
  const sorted = sortGroupLines([line("볼트", null), line("철판", "나 현장"), line("앵글", "가 현장"), line("볼트", "가 현장")]);
  assert.deepEqual(
    sorted.map((l) => `${l.projects?.name ?? "일반경비"}/${l.item_name}`),
    ["가 현장/볼트", "가 현장/앵글", "나 현장/철판", "일반경비/볼트"]
  );
});

test("묶음 한 줄 이름: 하나면 그 이름, 여럿이면 'A 외 N곳'(같은 이름은 한 번만)", () => {
  assert.equal(summaryLabel(["가짜 현장 A"], "곳"), "가짜 현장 A");
  assert.equal(summaryLabel(["가짜 현장 A", "가짜 현장 A"], "곳"), "가짜 현장 A");
  assert.equal(summaryLabel(["가짜 현장 A", "가짜 현장 B", "가짜 현장 A", "일반경비"], "곳"), "가짜 현장 A 외\u00a02곳");
  assert.equal(summaryLabel([], "건"), "");
});

test("묶음 전체 수정 가능 여부: 공통 칸이 모두 같을 때만(null·빈 값 차이는 같은 것으로)", () => {
  const base = {
    trans_date: "2026-10-01",
    type: "매입" as const,
    client_id: "c1",
    client_name_raw: null,
    category_id: "k1",
    payment_method_id: "p1",
    payment_type: "immediate" as const,
    tax_invoice_issued: true,
    vat_included: false,
    needs_classification: false,
    note1: null,
    note2: null,
  };
  assert.equal(sameCommonFields([base, { ...base }]), true);
  assert.equal(sameCommonFields([base, { ...base, category_id: "k2" }]), false);
  assert.equal(sameCommonFields([base, { ...base, note2: "정산일: 2026-10-05" }]), false);
  assert.equal(sameCommonFields([base, { ...base, note1: undefined as unknown as null }]), true);
});
