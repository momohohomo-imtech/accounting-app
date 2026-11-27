import { test } from "node:test";
import assert from "node:assert/strict";
import {
  distinctPaymentMethodCount,
  fillEmptyCategory,
  groupTaxFlags,
  lineTaxFlags,
  resolveLineCommons,
  splitLineCommons,
} from "@/lib/transactionLines";

// 가짜 품목 줄 — 프로젝트·카테고리·결제수단 id만
const line = (project_id = "", category_id = "", payment_method_id = "", item = "가짜 품목") => ({ item, project_id, category_id, payment_method_id });
const common = { project_id: "p-공통", category_id: "k-공통", payment_method_id: "m-공통" };

test("2줄이 되면 공통 칸 값을 빈 줄에 옮기고 공통 칸은 비움(이미 고른 줄은 그대로)", () => {
  const r = splitLineCommons([line(), line("p2", "", "m2")], common);
  assert.deepEqual(r.common, { project_id: "", category_id: "", payment_method_id: "" });
  assert.deepEqual(
    r.lines.map((l) => [l.project_id, l.category_id, l.payment_method_id]),
    [
      ["p-공통", "k-공통", "m-공통"],
      ["p2", "k-공통", "m2"],
    ]
  );
  assert.equal(r.lines[1].item, "가짜 품목");
});

test("2줄 이상에서 다시 나눠도 줄 값은 그대로(공통 칸이 비어 있으니 빈 줄은 빈 채로)", () => {
  const r = splitLineCommons([line("p1", "k1", ""), line("", "", "m2"), line()], { project_id: "", category_id: "", payment_method_id: "" });
  assert.deepEqual(
    r.lines.map((l) => [l.project_id, l.category_id, l.payment_method_id]),
    [
      ["p1", "k1", ""],
      ["", "", "m2"],
      ["", "", ""],
    ]
  );
});

test("1줄로 돌아오면 그 줄 값을 공통 칸으로(빈 값이면 공통 칸 그대로)", () => {
  const r = splitLineCommons([line("p1", "k1", "")], { project_id: "", category_id: "", payment_method_id: "m-예전" });
  assert.deepEqual(r.common, { project_id: "p1", category_id: "k1", payment_method_id: "m-예전" });
  assert.deepEqual([r.lines[0].project_id, r.lines[0].category_id, r.lines[0].payment_method_id], ["", "", ""]);
});

test("저장할 줄 값: 2줄 이상이면 카테고리·결제수단은 줄 값만, 1줄이면 공통 칸 — 프로젝트는 줄 값이 먼저", () => {
  assert.deepEqual(resolveLineCommons(line("", "k1", ""), common, true), { project_id: "p-공통", category_id: "k1", payment_method_id: "" });
  assert.deepEqual(resolveLineCommons(line("p9"), common, false), { project_id: "p9", category_id: "k-공통", payment_method_id: "m-공통" });
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

test("거래처 기본 카테고리는 카테고리가 빈 줄에만", () => {
  const r = fillEmptyCategory([line("", "k1"), line()], "k-기본");
  assert.deepEqual(
    r.map((l) => l.category_id),
    ["k1", "k-기본"]
  );
});

test("고른 결제수단 종류 수(빈 칸 빼고)", () => {
  assert.equal(distinctPaymentMethodCount([line("", "", "m1"), line("", "", "m1"), line()]), 1);
  assert.equal(distinctPaymentMethodCount([line("", "", "m1"), line("", "", "m2")]), 2);
  assert.equal(distinctPaymentMethodCount([line(), line()]), 0);
});
