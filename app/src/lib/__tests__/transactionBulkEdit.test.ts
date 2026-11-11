import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BULK_FIELDS,
  bulkChangeConfirmText,
  bulkClientNameOptions,
  bulkProjectSites,
  bulkProjectYears,
  bulkProjects,
  resolveBulkClient,
} from "@/lib/transactionBulkEdit";

// 가짜 자료만
const node = (id: string, year: number, siteId: string, siteName: string, clientName: string | null = null) => ({
  id,
  name: `가짜 프로젝트 ${id}`,
  year,
  siteId,
  siteName,
  clientName,
});
const nodes = [
  node("p1", 2026, "s1", "가짜 현장 가", "가짜 원청"),
  node("p2", 2026, "s2", "가짜 현장 나"),
  node("p3", 2025, "s1", "가짜 현장 가", "가짜 원청"),
  node("p4", 2026, "s1", "가짜 현장 가", "가짜 원청"),
];

test("바꿀 수 있는 칸 = 매입매출장과 같은 5가지(금액·날짜 없음)", () => {
  assert.deepEqual(
    BULK_FIELDS.map((f) => f.label),
    ["프로젝트", "거래처", "카테고리", "결제방식", "품목"]
  );
});

test("프로젝트 고르기: 연도(최근이 위) → 그 해 현장 → 그 해·현장 프로젝트", () => {
  assert.deepEqual(bulkProjectYears(nodes), [2026, 2025]);
  assert.deepEqual(bulkProjectSites(nodes, "2026"), [
    ["s1", "가짜 원청 · 가짜 현장 가"],
    ["s2", "가짜 현장 나"],
  ]);
  assert.deepEqual(bulkProjectSites(nodes, ""), []);
  assert.deepEqual(
    bulkProjects(nodes, "2026", "s1").map((p) => p.id),
    ["p1", "p4"]
  );
  assert.deepEqual(bulkProjects(nodes, "2026", ""), []);
});

test("거래처 자동완성: 등록 + 직접 입력, 같은 이름 한 번, 가나다", () => {
  assert.deepEqual(bulkClientNameOptions([{ name: "나가짜" }, { name: "가가짜" }], ["다가짜", null, "가가짜", ""]), [
    "가가짜",
    "나가짜",
    "다가짜",
  ]);
});

test("거래처 값: 고른 거래처(같은 이름 여럿이어도 고른 쪽) → 이름이 같은 등록 거래처 → 직접 입력 → 비움", () => {
  const clients = [
    { id: "c1", name: "가짜상사" },
    { id: "c2", name: "가짜상사" },
    { id: "c3", name: "가짜건재" },
  ];
  assert.deepEqual(resolveBulkClient(clients, "c2", "가짜상사"), { clientId: "c2", clientNameRaw: "", label: "가짜상사" });
  assert.deepEqual(resolveBulkClient(clients, "c2", " 가짜건재 "), { clientId: "c3", clientNameRaw: "", label: "가짜건재" });
  assert.deepEqual(resolveBulkClient(clients, "", "목록에 없는 가짜"), {
    clientId: "",
    clientNameRaw: "목록에 없는 가짜",
    label: "목록에 없는 가짜",
  });
  assert.deepEqual(resolveBulkClient(clients, "", "  "), { clientId: "", clientNameRaw: "", label: "" });
});

test("확인 문구: 값 → (으)로, 빈 값 → 비울까요, 프로젝트 빈 값 → 일반경비, 건수 쉼표", () => {
  assert.equal(
    bulkChangeConfirmText(3, "category", "가짜 자재비"),
    '선택한 3건의 카테고리를 "가짜 자재비"(으)로 바꿀까요? 금액·날짜는 그대로예요.'
  );
  assert.equal(bulkChangeConfirmText(2, "item_name", ""), "선택한 2건의 품목을 비울까요? 금액·날짜는 그대로예요.");
  assert.equal(
    bulkChangeConfirmText(1234, "project", null),
    '선택한 1,234건의 프로젝트를 "일반경비"(프로젝트 없음)로 바꿀까요? 금액·날짜는 그대로예요.'
  );
  assert.match(bulkChangeConfirmText(1, "payment_method", "가짜 카드"), /결제방식을 "가짜 카드"/);
  assert.match(bulkChangeConfirmText(1, "client", "가짜상사"), /거래처를 "가짜상사"/);
});
