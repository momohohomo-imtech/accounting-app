import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHometaxSheet, reconcileHometax, type AppInvoiceTx, type HometaxInvoice } from "@/lib/hometaxReconcile";

// 홈택스 목록 모양을 흉내 낸 가짜 표(실제 자료 아님) — 위에 제목·조회 조건 줄, 그 아래 머리글, 품목 포함이면 계산서가 여러 줄.
const HEADER = [
  "작성일자", "승인번호", "발급일자", "전송일자", "공급자사업자등록번호", "종사업장 번호", "상호", "대표자명", "주소",
  "공급받는자사업자등록번호", "종사업장 번호", "상호", "대표자명", "주소", "합계금액", "공급가액", "세액",
  "전자세금계산서분류", "전자세금계산서종류", "발급유형", "비고", "영수/청구 구분", "품목일자", "품목명", "품목공급가액", "품목세액",
];
function row(date: string, approval: string, supplierBiz: string, supplier: string, buyerBiz: string, buyer: string, supply: number, tax: number, item: string) {
  return [date, approval, date, date, supplierBiz, "", supplier, "가짜", "가짜 주소", buyerBiz, "", buyer, "가짜", "가짜 주소",
    (supply + tax).toLocaleString(), supply.toLocaleString(), tax.toLocaleString(), "세금계산서", "일반", "전자발급", "", "청구", date, item,
    supply.toLocaleString(), tax.toLocaleString()];
}
const SALES_SHEET = [
  ["매출 전자세금계산서 목록조회"],
  ["조회기간 2026-07-01 ~ 2026-09-30"],
  [],
  HEADER,
  row("2026-07-03", "A-1", "111-11-11111", "가짜우리회사", "222-22-22222", "(주)가짜갑건설", 1_000_000, 100_000, "가짜 공사 1차"),
  row("2026-07-03", "A-1", "111-11-11111", "가짜우리회사", "222-22-22222", "(주)가짜갑건설", 1_000_000, 100_000, "가짜 품목 둘째 줄"),
  row("20260815", "A-2", "111-11-11111", "가짜우리회사", "333-33-33333", "가짜을상사", 500_000, 50_000, "가짜 공사"),
  ["합계", "", "", "", "", "", "", "", "", "", "", "", "", "", "1,650,000"],
];

test("홈택스 목록 읽기: 머리글 찾기·제목으로 매출/매입 알아보기·승인번호로 한 번만·매출이면 공급받는자가 거래처", () => {
  const { invoices, detectedKind, error } = parseHometaxSheet(SALES_SHEET, "매출");
  assert.equal(error, null);
  assert.equal(detectedKind, "매출");
  assert.deepEqual(
    invoices.map((i) => [i.row, i.date, i.approvalNo, i.counterparty, i.counterpartyBizNo, i.supply, i.tax, i.total]),
    [
      [5, "2026-07-03", "A-1", "(주)가짜갑건설", "2222222222", 1_000_000, 100_000, 1_100_000],
      [7, "2026-08-15", "A-2", "가짜을상사", "3333333333", 500_000, 50_000, 550_000],
    ]
  );
  // 같은 파일을 매입으로 읽으면 거래처는 공급자
  assert.equal(parseHometaxSheet(SALES_SHEET, "매입").invoices[0].counterparty, "가짜우리회사");
  assert.match(parseHometaxSheet([["아무 표"], ["가", "나"]], "매출").error ?? "", /머리글/);
});

const inv = (p: Partial<HometaxInvoice>): HometaxInvoice => ({
  row: 1, date: "2026-07-03", approvalNo: "", counterparty: "가짜갑", counterpartyBizNo: "", supply: 100_000, tax: 10_000, total: 110_000, item: "", ...p,
});
const tx = (p: Partial<AppInvoiceTx>): AppInvoiceTx => ({
  id: "t", date: "2026-07-03", client: "가짜갑", clientBizNo: "", supply: 100_000, tax: 10_000, taxInvoice: true, groupId: null, item: null, ...p,
});
const PERIOD = { start: "2026-07-01", end: "2026-09-30" };

test("대조: 같은 날·같은 금액은 일치(반올림 차이 허용), 한 결제 묶음·같은 날 같은 거래처 나눠 적은 것은 합쳐서", () => {
  const r = reconcileHometax(
    [
      inv({ row: 1 }),
      inv({ row: 2, date: "2026-07-10", supply: 300_000, tax: 30_000, total: 330_000 }),
      inv({ row: 3, date: "2026-07-20", counterparty: "가짜병", supply: 200_000, tax: 20_000, total: 220_000 }),
      inv({ row: 4, date: "2026-07-25", supply: 90_909, tax: 9_091, total: 100_000 }),
    ],
    [
      tx({ id: "a" }),
      tx({ id: "g1", date: "2026-07-10", supply: 100_000, tax: 10_000, groupId: "G", client: "가짜정" }),
      tx({ id: "g2", date: "2026-07-10", supply: 200_000, tax: 20_000, groupId: "G", client: "가짜정" }),
      tx({ id: "s1", date: "2026-07-20", client: "가짜병", supply: 150_000, tax: 15_000 }),
      tx({ id: "s2", date: "2026-07-20", client: "가짜병", supply: 50_000, tax: 5_000 }),
      tx({ id: "r", date: "2026-07-25", supply: 90_910, tax: 9_090 }), // 앱이 합계에서 나눈 반올림 차이
    ],
    PERIOD
  );
  assert.deepEqual(r.matched.map((m) => [m.invoice.row, m.txIds.sort().join(",")]), [
    [1, "a"],
    [2, "g1,g2"],
    [3, "s1,s2"],
    [4, "r"],
  ]);
  assert.deepEqual([r.hometaxOnly.length, r.appOnly.length, r.mismatched.length, r.missingFlag.length], [0, 0, 0, 0]);
});

test("대조: 거래처가 같은 것 먼저 짝지음 — 같은 날 같은 금액 계산서가 둘이면 엉뚱한 짝을 만들지 않음", () => {
  const r = reconcileHometax(
    [inv({ row: 1, counterparty: "가짜갑" }), inv({ row: 2, counterparty: "가짜을" })],
    [tx({ id: "eul", client: "가짜을" })],
    PERIOD
  );
  assert.deepEqual(r.matched.map((m) => [m.invoice.row, m.txIds[0]]), [[2, "eul"]]);
  assert.deepEqual(r.hometaxOnly.map((i) => i.row), [1]);
});

test("대조: 홈택스에만·앱에만(세금계산서 표시만, 기간 안만)·날짜 다름·금액 다름·세금계산서 표시 빠짐", () => {
  const r = reconcileHometax(
    [
      inv({ row: 1, counterparty: "가짜갑", counterpartyBizNo: "1234567890" }), // 앱에 사업자번호로 짝 — 날짜만 다름
      inv({ row: 2, date: "2026-08-01", counterparty: "가짜을", supply: 50_000, tax: 5_000, total: 55_000 }), // 같은 날 금액 다름
      inv({ row: 3, date: "2026-09-01", counterparty: "가짜병" }), // 앱에 없음
      inv({ row: 4, date: "2026-09-05", counterparty: "가짜정" }), // 맞는데 앱에 세금계산서 체크 없음
    ],
    [
      tx({ id: "late", date: "2026-07-20", client: "이름이 다른 가짜", clientBizNo: "123-45-67890" }),
      tx({ id: "diff", date: "2026-08-01", client: "가짜을", supply: 60_000, tax: 6_000 }),
      tx({ id: "noflag", date: "2026-09-05", client: "가짜정", taxInvoice: false }),
      tx({ id: "extra", date: "2026-09-10", client: "가짜무" }), // 앱에만
      tx({ id: "receipt", date: "2026-09-11", client: "가짜무", taxInvoice: false }), // 영수증 거래 — 앱에만에 안 넣음
      tx({ id: "outside", date: "2026-10-02", client: "가짜무" }), // 기간 밖
    ],
    PERIOD
  );
  assert.deepEqual(r.mismatched.map((m) => [m.invoice.row, m.tx.id, m.reason]), [
    [1, "late", "날짜 다름"],
    [2, "diff", "금액 다름"],
  ]);
  assert.deepEqual(r.hometaxOnly.map((i) => i.row), [3]);
  assert.deepEqual(r.matched.map((m) => m.txIds[0]), ["noflag"]);
  assert.deepEqual(r.missingFlag.map((t) => t.id), ["noflag"]);
  assert.deepEqual(r.appOnly.map((t) => t.id), ["extra"]);
});
