import { test } from "node:test";
import assert from "node:assert/strict";
import { applyLedgerSearch, matchesLedgerSearch, searchTerms } from "@/lib/ledgerSearch";

// 가짜 자료만
const tx = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  payment_group_id: null as string | null,
  client_name_raw: null as string | null,
  item_name: null as string | null,
  note1: null as string | null,
  note2: null as string | null,
  sales_amount: 0,
  sales_vat: 0,
  purchase_amount: 0,
  purchase_vat: 0,
  clients: null as { name: string } | null,
  projects: null as { name: string } | null,
  expense_categories: null as { name: string } | null,
  ...extra,
});

test("검색어 → 낱말: 띄어쓰기로 나눔, 대소문자 무시, 빈 칸은 없음", () => {
  assert.deepEqual(searchTerms("  가짜철물  ABC "), ["가짜철물", "abc"]);
  assert.deepEqual(searchTerms(""), []);
  assert.deepEqual(searchTerms(null), []);
  assert.equal(searchTerms("가".repeat(150))[0].length, 100);
});

test("거래처·품목·메모·프로젝트·카테고리에서 찾고, 띄어쓰기는 무시, 낱말은 모두 들어 있어야", () => {
  const a = tx("a", { clients: { name: "가짜 철물상사" }, item_name: "볼트", note2: "현장 반납" });
  assert.ok(matchesLedgerSearch(a, searchTerms("철물")));
  assert.ok(matchesLedgerSearch(a, searchTerms("가짜철물")), "띄어쓰기 무시");
  assert.ok(matchesLedgerSearch(a, searchTerms("철물 볼트")), "낱말 두 개 모두");
  assert.ok(!matchesLedgerSearch(a, searchTerms("철물 너트")), "하나라도 없으면 아님");
  assert.ok(matchesLedgerSearch(a, searchTerms("반납")), "메모2");
  const b = tx("b", { client_name_raw: "직접입력 가짜상회", projects: [{ name: "가짜 현장공사" }], expense_categories: { name: "자재비" } });
  assert.ok(matchesLedgerSearch(b, searchTerms("가짜상회")));
  assert.ok(matchesLedgerSearch(b, searchTerms("현장공사")), "프로젝트(배열 모양도)");
  assert.ok(matchesLedgerSearch(b, searchTerms("자재")), "카테고리");
});

test("숫자만 적으면 합계 금액이 같은 거래도(쉼표 있어도)", () => {
  const c = tx("c", { purchase_amount: 136364, purchase_vat: 13636 });
  assert.ok(matchesLedgerSearch(c, searchTerms("150000")));
  assert.ok(matchesLedgerSearch(c, searchTerms("150,000")));
  assert.ok(!matchesLedgerSearch(c, searchTerms("15000")), "금액은 같을 때만");
  assert.ok(matchesLedgerSearch(tx("d", { item_name: "가짜 2x4 각재 12개" }), searchTerms("12")), "글자에 숫자가 있으면 그것도");
});

test("마이너스 금액 줄(할인·단수 조정)도 금액으로 찾음 — 부호 없이 적어도, \"-\"를 붙이면 마이너스만", () => {
  const minus = tx("m", { item_name: "가짜 단수 조정", purchase_amount: -7000, purchase_vat: 0 });
  const plus = tx("p", { item_name: "가짜 볼트", purchase_amount: 7000, purchase_vat: 0 });
  assert.ok(matchesLedgerSearch(minus, searchTerms("7000")));
  assert.ok(matchesLedgerSearch(minus, searchTerms("7,000")));
  assert.ok(matchesLedgerSearch(minus, searchTerms("-7000")));
  assert.ok(matchesLedgerSearch(minus, searchTerms("-7,000")));
  assert.ok(matchesLedgerSearch(plus, searchTerms("7000")));
  assert.ok(!matchesLedgerSearch(plus, searchTerms("-7000")), "\"-\"를 붙이면 플러스 금액은 안 찾음");
  assert.ok(!matchesLedgerSearch(minus, searchTerms("700")), "금액은 같을 때만");
  // 부가세가 붙은 마이너스 줄은 합계(공급가 + 부가세)로
  assert.ok(matchesLedgerSearch(tx("v", { purchase_amount: -105, purchase_vat: -11 }), searchTerms("116")));
});

test("한 결제 묶음은 한 줄만 맞아도 묶음 전체, 검색어가 없으면 그대로", () => {
  const rows = [
    tx("g1", { payment_group_id: "G", item_name: "가짜 페인트" }),
    tx("g2", { payment_group_id: "G", item_name: "가짜 붓" }),
    tx("x", { item_name: "가짜 페인트" }),
    tx("y", { item_name: "가짜 테이프" }),
  ];
  assert.deepEqual(applyLedgerSearch(rows, "붓").map((r) => r.id), ["g1", "g2"]);
  assert.deepEqual(applyLedgerSearch(rows, "페인트").map((r) => r.id), ["g1", "g2", "x"]);
  assert.equal(applyLedgerSearch(rows, "  "), rows);
  assert.deepEqual(applyLedgerSearch(rows, "없는글자"), []);
});
