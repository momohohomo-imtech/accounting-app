import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BULK_FIELDS,
  bulkChangesConfirmText,
  bulkClientNameOptions,
  bulkPatchFromForm,
  exemptInvoiceConflicts,
  exemptInvoiceMessage,
  needsExemptInvoiceCheck,
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

test("바꿀 수 있는 칸 = 6가지(11/26 세금계산서 추가, 금액·날짜 없음)", () => {
  assert.deepEqual(
    BULK_FIELDS.map((f) => f.label),
    ["프로젝트", "거래처", "카테고리", "결제방식", "세금계산서", "품목"]
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

test("확인 문구: 바꿀 칸마다 한 줄 — 값은 따옴표, 빈 값은 비움, 프로젝트 빈 값은 일반경비, 세금계산서는 발행·미발행, 건수 쉼표", () => {
  assert.equal(
    bulkChangesConfirmText(3, [
      { field: "category", label: "가짜 자재비" },
      { field: "payment_method", label: null },
      { field: "tax_invoice", label: "발행" },
    ]),
    ["선택한 3건을 이렇게 바꿀까요?", '· 카테고리 → "가짜 자재비"', "· 결제방식 → 비움", "· 세금계산서 → 발행", "금액·날짜는 그대로예요."].join("\n")
  );
  assert.match(bulkChangesConfirmText(1234, [{ field: "project", label: null }]), /^선택한 1,234건을[\s\S]*· 프로젝트 → "일반경비"\(프로젝트 없음\)/);
  assert.match(bulkChangesConfirmText(1, [{ field: "client", label: "가짜상사" }]), /· 거래처 → "가짜상사"/);
});

test("폼 값 → 바꿀 칸: 없는 칸은 그대로, 빈 글자는 비움(프로젝트는 일반경비 + 분류 대기 풂), 거래처는 하나만, 품목 빈 글자는 그대로", () => {
  const from = (o: Record<string, string>) => (k: string) => (k in o ? o[k] : null);
  assert.deepEqual(bulkPatchFromForm(from({})), { patch: {}, fields: [] });
  assert.deepEqual(bulkPatchFromForm(from({ item_name: "  " })), { patch: {}, fields: [] });
  const all = bulkPatchFromForm(
    from({ project_id: "", client_id: "c1", client_name_raw: "무시", category_id: "cat1", payment_method_id: "", tax_invoice_issued: "1", item_name: " 가짜 품목 " })
  );
  assert.deepEqual(all.fields, ["project", "client", "category", "payment_method", "tax_invoice", "item_name"]);
  assert.deepEqual(all.patch, {
    project_id: null,
    needs_classification: false,
    client_id: "c1",
    client_name_raw: null,
    category_id: "cat1",
    payment_method_id: null,
    tax_invoice_issued: true,
    item_name: "가짜 품목",
  });
  assert.deepEqual(bulkPatchFromForm(from({ client_id: "", client_name_raw: " 가짜 직접 " })).patch, { client_id: null, client_name_raw: "가짜 직접" });
  assert.deepEqual(bulkPatchFromForm(from({ client_id: "", client_name_raw: "" })).patch, { client_id: null, client_name_raw: null });
  assert.deepEqual(bulkPatchFromForm(from({ tax_invoice_issued: "0" })).patch, { tax_invoice_issued: false });
});

test("비과세 카테고리 + 세금계산서 발행이 되는 거래는 막음(거래 등록 화면과 같은 규칙)", () => {
  const cats = [
    { id: "cat-mat", name: "가짜 자재", vat_exempt: false },
    { id: "cat-pay", name: "가짜 인건비", vat_exempt: true },
  ];
  const rows = [
    { id: "t1", trans_date: "2026-11-03", item_name: "가짜 일당", category_id: "cat-pay", tax_invoice_issued: false },
    { id: "t2", trans_date: "2026-11-04", item_name: "가짜 철근", category_id: "cat-mat", tax_invoice_issued: true },
    { id: "t3", trans_date: "2026-11-05", item_name: null, category_id: null, tax_invoice_issued: false },
  ];
  // 세금계산서 → 발행: 비과세 카테고리 줄(t1)만 걸림
  assert.deepEqual(exemptInvoiceConflicts(rows, cats, { tax_invoice_issued: true }).map((r) => r.id), ["t1"]);
  // 발행 + 카테고리도 자재로 같이 바꾸면 걸리는 줄 없음
  assert.deepEqual(exemptInvoiceConflicts(rows, cats, { tax_invoice_issued: true, category_id: "cat-mat" }), []);
  // 카테고리 → 비과세: 이미 발행인 줄(t2)만 걸림, 미발행으로 같이 바꾸면 없음
  assert.deepEqual(exemptInvoiceConflicts(rows, cats, { category_id: "cat-pay" }).map((r) => r.id), ["t2"]);
  assert.deepEqual(exemptInvoiceConflicts(rows, cats, { category_id: "cat-pay", tax_invoice_issued: false }), []);
  // 카테고리 비우기·결제방식만 바꾸기는 확인할 필요 없음
  assert.equal(needsExemptInvoiceCheck({ category_id: null }), false);
  assert.equal(needsExemptInvoiceCheck({ payment_method_id: "pm1" }), false);
  assert.equal(needsExemptInvoiceCheck({ tax_invoice_issued: false, category_id: "cat-pay" }), false);
  assert.equal(needsExemptInvoiceCheck({ tax_invoice_issued: true }), true);
  // 안내 문구: 날짜(월-일)·품목, 3건 넘으면 "외 N건"
  const many = Array.from({ length: 5 }, (_, i) => ({ ...rows[0], id: `x${i}` }));
  assert.equal(
    exemptInvoiceMessage(many, { tax_invoice_issued: true }),
    "비과세 카테고리 거래 5건은 세금계산서 발행으로 바꿀 수 없습니다(비과세는 세금계산서 없음) — 11-03 가짜 일당, 11-03 가짜 일당, 11-03 가짜 일당 외 2건. 그 거래를 빼고 다시 바꿔 주세요."
  );
  assert.match(exemptInvoiceMessage([rows[1]], { category_id: "cat-pay" }), /^세금계산서 발행인 거래 1건은 비과세 카테고리로 바꿀 수 없습니다 — 11-04 가짜 철근\. 세금계산서를 "미발행"으로/);
});
