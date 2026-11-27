import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clientHistoryKey,
  clientHistoryQuery,
  clientPairFromText,
  distinctClientCount,
  distinctPaymentMethodCount,
  fillClientDefaults,
  groupTaxFlags,
  lineClientText,
  lineTaxFlags,
  resolveLineCommons,
  settleClientPair,
  splitLineCommons,
} from "@/lib/transactionLines";

// 가짜 품목 줄 — 거래처·프로젝트·카테고리·결제수단 id만
const line = (project_id = "", category_id = "", payment_method_id = "", client_id = "", client_name_raw = "") => ({
  item_name: "가짜 품목",
  project_id,
  category_id,
  payment_method_id,
  client_id,
  client_name_raw,
});
const empty = { project_id: "", category_id: "", payment_method_id: "", client_id: "", client_name_raw: "" };
const common = { project_id: "p-공통", category_id: "k-공통", payment_method_id: "m-공통", client_id: "c-공통", client_name_raw: "" };
const ids = (l: ReturnType<typeof line>) => [l.project_id, l.category_id, l.payment_method_id, l.client_id, l.client_name_raw];
const clients = [
  { id: "c1", name: "가짜 자재상", default_item_name: "가짜 배관", default_category_id: "k1" },
  { id: "c2", name: "가짜 통신사", default_item_name: null, default_category_id: null },
];

test("2줄이 되면 공통 칸 값을 빈 줄에 옮기고 공통 칸은 비움(이미 고른 줄은 그대로)", () => {
  const r = splitLineCommons([line(), line("p2", "", "m2", "", "가짜 직접 업체")], common);
  assert.deepEqual(r.common, empty);
  assert.deepEqual(r.lines.map(ids), [
    ["p-공통", "k-공통", "m-공통", "c-공통", ""],
    ["p2", "k-공통", "m2", "", "가짜 직접 업체"],
  ]);
  assert.equal(r.lines[1].item_name, "가짜 품목");
});

test("거래처는 등록 거래처·직접 입력 이름을 한 묶음으로 옮김(한쪽만 섞이지 않게)", () => {
  // 공통 칸이 직접 입력 이름이고 줄이 등록 거래처면 줄 것 그대로 — 직접 입력 이름이 끼어들지 않음
  const r = splitLineCommons([line("", "", "", "c1", ""), line()], { ...empty, client_name_raw: "가짜 공통 업체" });
  assert.deepEqual(r.lines.map((l) => [l.client_id, l.client_name_raw]), [
    ["c1", ""],
    ["", "가짜 공통 업체"],
  ]);
  // 둘 다 적힌 예전 자료(등록 거래처 + 직접 입력 이름)도 그대로 옮김
  const both = splitLineCommons([line("", "", "", "c1", "가짜 메모성 이름")], empty);
  assert.deepEqual([both.common.client_id, both.common.client_name_raw], ["c1", "가짜 메모성 이름"]);
});

test("2줄 이상에서 다시 나눠도 줄 값은 그대로(공통 칸이 비어 있으니 빈 줄은 빈 채로)", () => {
  const r = splitLineCommons([line("p1", "k1", "", "c1"), line("", "", "m2"), line()], empty);
  assert.deepEqual(r.lines.map(ids), [
    ["p1", "k1", "", "c1", ""],
    ["", "", "m2", "", ""],
    ["", "", "", "", ""],
  ]);
});

test("1줄로 돌아오면 그 줄 값을 공통 칸으로(빈 값이면 공통 칸 그대로)", () => {
  const r = splitLineCommons([line("p1", "k1", "", "", "가짜 직접 업체")], { ...empty, payment_method_id: "m-예전", client_id: "c-예전" });
  assert.deepEqual(r.common, { project_id: "p1", category_id: "k1", payment_method_id: "m-예전", client_id: "", client_name_raw: "가짜 직접 업체" });
  assert.deepEqual(ids(r.lines[0]), ["", "", "", "", ""]);
  const keep = splitLineCommons([line("p1")], { ...empty, client_id: "c-예전" });
  assert.deepEqual([keep.common.client_id, keep.common.client_name_raw], ["c-예전", ""]);
});

test("저장할 줄 값: 2줄 이상이면 거래처·카테고리·결제수단은 줄 값만, 1줄이면 공통 칸 — 프로젝트는 줄 값이 먼저", () => {
  assert.deepEqual(resolveLineCommons(line("", "k1"), common, true), { ...empty, project_id: "p-공통", category_id: "k1" });
  assert.deepEqual(resolveLineCommons(line("p9"), common, false), { ...common, project_id: "p9" });
  assert.deepEqual(resolveLineCommons(line(), common, false), common);
});

test("비과세 카테고리 줄은 위쪽 VAT·세금계산서 체크와 상관없이 둘 다 끔", () => {
  assert.deepEqual(lineTaxFlags(true, { vat_included: true, tax_invoice_issued: true }), { vat_included: false, tax_invoice_issued: false });
  assert.deepEqual(lineTaxFlags(false, { vat_included: true, tax_invoice_issued: false }), { vat_included: true, tax_invoice_issued: false });
});

test("묶음 전체 수정의 VAT·세금계산서 체크 = 비과세가 아닌 줄 값(모두 비과세면 끔)", () => {
  const lines = [
    { id: "a", exempt: true, vat_included: false, tax_invoice_issued: false },
    { id: "b", exempt: false, vat_included: true, tax_invoice_issued: true },
  ];
  assert.deepEqual(groupTaxFlags(lines, (l) => l.exempt), { vat_included: true, tax_invoice_issued: true });
  assert.deepEqual(groupTaxFlags([lines[0]], (l) => l.exempt), { vat_included: false, tax_invoice_issued: false });
});

test("줄 거래처 칸: 등록 거래처 이름과 똑같으면 등록 거래처, 아니면 직접 입력 — 치는 중엔 빈칸 그대로, 벗어날 때 정리", () => {
  assert.deepEqual(clientPairFromText("가짜 자재상", clients), { client_id: "c1", client_name_raw: "" });
  assert.deepEqual(clientPairFromText("가짜 자재상 ", clients), { client_id: "", client_name_raw: "가짜 자재상 " });
  assert.deepEqual(clientPairFromText("가짜 새 업체", clients), { client_id: "", client_name_raw: "가짜 새 업체" });
  assert.deepEqual(settleClientPair({ client_id: "", client_name_raw: " 가짜 자재상 " }, clients), { client_id: "c1", client_name_raw: "" });
  assert.deepEqual(settleClientPair({ client_id: "", client_name_raw: " 가짜 새 업체 " }, clients), { client_id: "", client_name_raw: "가짜 새 업체" });
  assert.deepEqual(settleClientPair({ client_id: "c2", client_name_raw: "가짜 메모" }, clients), { client_id: "c2", client_name_raw: "가짜 메모" });
  assert.equal(lineClientText({ client_id: "c1", client_name_raw: "" }, clients), "가짜 자재상");
  assert.equal(lineClientText({ client_id: "c-없음", client_name_raw: "가짜 예전 이름" }, clients), "가짜 예전 이름");
  assert.equal(lineClientText({ client_id: "", client_name_raw: "가짜 직접" }, clients), "가짜 직접");
});

test("거래처 기본 품목·카테고리는 그 줄의 빈칸에만", () => {
  assert.deepEqual(fillClientDefaults({ item_name: "", category_id: "" }, clients[0]), { item_name: "가짜 배관", category_id: "k1" });
  assert.deepEqual(fillClientDefaults({ item_name: "가짜 적은 품목", category_id: "k9" }, clients[0]), { item_name: "가짜 적은 품목", category_id: "k9" });
  assert.deepEqual(fillClientDefaults({ item_name: "", category_id: "" }, clients[1]), { item_name: "", category_id: "" });
  assert.deepEqual(fillClientDefaults({ item_name: "", category_id: "" }, undefined), { item_name: "", category_id: "" });
});

test("예전 품목 열쇠: 등록 거래처는 id, 직접 입력은 두 글자부터(앞뒤 빈칸 뺌)", () => {
  assert.equal(clientHistoryKey({ client_id: "c1", client_name_raw: "가짜 메모" }), "id:c1");
  assert.equal(clientHistoryKey({ client_id: "", client_name_raw: " 가짜 업체 " }), "name:가짜 업체");
  assert.equal(clientHistoryKey({ client_id: "", client_name_raw: " 가 " }), null);
  assert.deepEqual(clientHistoryQuery("id:c1"), { clientId: "c1" });
  assert.deepEqual(clientHistoryQuery("name:가짜 업체"), { clientName: "가짜 업체" });
});

test("고른 거래처·결제수단 종류 수(빈 칸 빼고)", () => {
  assert.equal(distinctClientCount([line("", "", "", "c1"), line("", "", "", "c1"), line()]), 1);
  assert.equal(distinctClientCount([line("", "", "", "c1"), line("", "", "", "", "가짜 직접")]), 2);
  assert.equal(distinctClientCount([line("", "", "", "", "가짜 직접 "), line("", "", "", "", "가짜 직접")]), 1);
  assert.equal(distinctPaymentMethodCount([line("", "", "m1"), line("", "", "m1"), line()]), 1);
  assert.equal(distinctPaymentMethodCount([line("", "", "m1"), line("", "", "m2")]), 2);
  assert.equal(distinctPaymentMethodCount([line(), line()]), 0);
});
