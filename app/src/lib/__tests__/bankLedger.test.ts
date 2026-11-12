import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BANK_LEDGER_PAYMENT_METHOD,
  isLedgerRowUntouched,
  ledgerRowFromBank,
  type BankTxForLedger,
} from "@/lib/bankLedger";

// 가짜 자료만
const out: BankTxForLedger = {
  trans_date: "2026-11-05",
  direction: "출금",
  amount: 120000,
  description: "가짜 출금",
  matched_client_id: "c1",
  matched_client_name_raw: null,
  bank_accounts: { nickname: "가짜 운영계좌", bank_name: "가짜은행" },
  clients: { name: "가짜상사" },
};

test("은행 출금 → 매입, 입금 → 매출(분류 대기 중, 즉시결제)", () => {
  const purchase = ledgerRowFromBank(out);
  assert.equal(purchase.type, "매입");
  assert.equal(purchase.purchase_amount, 120000);
  assert.equal(purchase.sales_amount, 0);
  assert.equal(purchase.item_name, "가짜상사");
  assert.equal(purchase.note1, "[은행] 가짜 운영계좌 · 가짜 출금");
  assert.equal(purchase.needs_classification, true);
  assert.equal(purchase.payment_type, "immediate");
  const sale = ledgerRowFromBank({ ...out, direction: "입금", clients: null, matched_client_id: null, bank_accounts: { nickname: null, bank_name: "가짜은행" } });
  assert.equal(sale.type, "매출");
  assert.equal(sale.sales_amount, 120000);
  assert.equal(sale.purchase_amount, 0);
  assert.equal(sale.item_name, "가짜 출금"); // 매칭 거래처가 없으면 내용
  assert.equal(sale.note1, "[은행] 가짜은행 · 가짜 출금");
});

test("결제방식 기본값은 송금(11/12 사용자 요청)", () => {
  assert.equal(BANK_LEDGER_PAYMENT_METHOD, "송금");
});

test("등록 당시 그대로인지: 결제방식은 송금 또는 빈칸(예전에 올린 줄)이면 그대로", () => {
  const ledger = { ...ledgerRowFromBank(out), id: "t1", project_id: null, category_id: null, note2: null, quantity: null, unit_price: null };
  // 금액은 DB에서 글자로 와도 같은 값이면 같음
  assert.equal(isLedgerRowUntouched({ ...ledger, purchase_amount: "120000", payment_method_id: "pm-remit" }, out, "pm-remit"), true);
  assert.equal(isLedgerRowUntouched({ ...ledger, payment_method_id: null }, out, "pm-remit"), true);
  assert.equal(isLedgerRowUntouched({ ...ledger, payment_method_id: null }, out, null), true);
  // 다른 결제방식으로 바꿨으면 손댄 것, 송금을 못 찾았으면(이름 바꿈·조회 실패) 빈칸만 그대로
  assert.equal(isLedgerRowUntouched({ ...ledger, payment_method_id: "pm-card" }, out, "pm-remit"), false);
  assert.equal(isLedgerRowUntouched({ ...ledger, payment_method_id: "pm-remit" }, out, null), false);
});

test("등록 당시 그대로인지: 분류·수정한 줄은 손댄 것(지우지 않음)", () => {
  const ledger = { ...ledgerRowFromBank(out), payment_method_id: "pm-remit", project_id: null, category_id: null, note2: null, quantity: null, unit_price: null };
  assert.equal(isLedgerRowUntouched({ ...ledger, category_id: "cat1" }, out, "pm-remit"), false);
  assert.equal(isLedgerRowUntouched({ ...ledger, project_id: "p1" }, out, "pm-remit"), false);
  assert.equal(isLedgerRowUntouched({ ...ledger, note2: "가짜 메모" }, out, "pm-remit"), false);
  assert.equal(isLedgerRowUntouched({ ...ledger, purchase_amount: 130000 }, out, "pm-remit"), false);
  assert.equal(isLedgerRowUntouched({ ...ledger, needs_classification: false }, out, "pm-remit"), false);
  // 은행 쪽 내용을 바꿔도 다르게 나옴(어느 쪽이 바뀐 건지 모르니 지우지 않음)
  assert.equal(isLedgerRowUntouched(ledger, { ...out, description: "가짜 바뀐 내용" }, "pm-remit"), false);
});
