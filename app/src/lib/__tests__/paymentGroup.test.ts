import { test } from "node:test";
import assert from "node:assert/strict";
import { groupLedgerRows, summaryLabel, sameCommonFields, sortGroupLines, dateSpan, groupKindLabel } from "@/lib/paymentGroup";

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

test("묶음 날짜: 외상 정산 묶음은 계산서 날짜 처음~마지막, 같은 날이면 하나", () => {
  assert.deepEqual(dateSpan([{ trans_date: "2026-09-28" }, { trans_date: "2026-09-03" }, { trans_date: "2026-09-15" }]), {
    first: "2026-09-03",
    last: "2026-09-28",
  });
  assert.deepEqual(dateSpan([{ trans_date: "2026-10-10" }, { trans_date: "2026-10-10" }]), {
    first: "2026-10-10",
    last: "2026-10-10",
  });
});

test("묶음 구분: 모두 외상이면 '외상 정산 N건', 하나라도 즉시결제면 'N건 묶음'", () => {
  assert.equal(groupKindLabel([{ payment_type: "credit" }, { payment_type: "credit" }, { payment_type: "credit" }]), "외상 정산 3건");
  assert.equal(groupKindLabel([{ payment_type: "immediate" }, { payment_type: "immediate" }]), "2건 묶음");
  assert.equal(groupKindLabel([{ payment_type: "credit" }, { payment_type: "immediate" }]), "2건 묶음");
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
  // 거래처·카테고리·결제수단은 11/27부터 줄마다 고름 — 달라도 묶음 전체 수정(줄마다 자기 값으로 저장)
  assert.equal(sameCommonFields([base, { ...base, category_id: "k2" }]), true);
  assert.equal(sameCommonFields([base, { ...base, payment_method_id: "p2" }]), true);
  assert.equal(sameCommonFields([base, { ...base, client_id: "c2" }]), true);
  const rawClientLine = { ...base, client_id: null, client_name_raw: "가짜 직접 업체" };
  assert.equal(sameCommonFields([base, rawClientLine]), true);
  assert.equal(sameCommonFields([base, { ...base, note2: "정산일: 2026-10-05" }]), false);
  assert.equal(sameCommonFields([base, { ...base, trans_date: "2026-10-02" }]), false);
  assert.equal(sameCommonFields([base, { ...base, payment_type: "credit" as const }]), false);
  assert.equal(sameCommonFields([base, { ...base, tax_invoice_issued: false }]), false);
  assert.equal(sameCommonFields([base, { ...base, note1: undefined as unknown as null }]), true);
});

test("묶음 전체 수정: 비과세 카테고리 줄은 VAT·세금계산서가 꺼져 있으면 다른 줄과 달라도 됨(켜져 있으면 그 줄만 수정)", () => {
  const taxed = {
    trans_date: "2026-10-01",
    type: "매입" as const,
    client_id: "c1",
    client_name_raw: null,
    payment_type: "immediate" as const,
    tax_invoice_issued: true,
    vat_included: true,
    needs_classification: false,
    note1: null,
    note2: null,
    expense_categories: { name: "가짜 자재", vat_exempt: false },
  };
  const exemptOff = { ...taxed, tax_invoice_issued: false, vat_included: false, expense_categories: { name: "가짜 인건비", vat_exempt: true } };
  assert.equal(sameCommonFields([taxed, exemptOff]), true);
  assert.equal(sameCommonFields([exemptOff, taxed, { ...taxed }]), true);
  // 비과세인데 켜져 있는 예전 자료 — 한꺼번에 저장하면 꺼지며 금액이 바뀌므로 묶음 전체 수정 안 함
  assert.equal(sameCommonFields([taxed, { ...exemptOff, vat_included: true }]), false);
  // 비과세 아닌 줄끼리는 같아야 함
  assert.equal(sameCommonFields([taxed, { ...taxed, vat_included: false }, exemptOff]), false);
  // 카테고리를 안 붙이면 예전처럼 모든 줄이 같아야 함
  const { expense_categories: _a, ...plainTaxed } = taxed;
  const { expense_categories: _b, ...plainExempt } = exemptOff;
  void _a;
  void _b;
  assert.equal(sameCommonFields([plainTaxed, plainExempt]), false);
  // 모두 비과세(꺼짐)면 됨
  assert.equal(sameCommonFields([exemptOff, { ...exemptOff }]), true);
});
