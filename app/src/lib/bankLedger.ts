// 은행 거래 → 매입/매출장 "분류 대기 중" 줄(은행 화면 "등록" 버튼). 등록할 때 넣는 값과, 나중에 등록 취소·은행 거래 삭제 때
// "등록 당시 그대로인지" 비교하는 기준을 이 파일 하나로 — 둘이 어긋나면 사용자가 손댄 장부 줄을 지우거나, 손대지 않은 줄을 못 지움.
// 저장은 lib/actions/bank.ts. 검사: bankLedger.test.ts

/**
 * 등록할 때 넣는 결제방식(결제수단 이름) — 11/12 사용자 요청 "은행내역에서 등록 눌러 매입장으로 보낼 때 송금을 기본으로".
 * 002 SQL 기본 결제수단 중 하나. 목록에 이 이름이 없으면(이름을 바꾼 경우) 예전처럼 빈칸으로 들어감.
 */
export const BANK_LEDGER_PAYMENT_METHOD = "송금";

export type BankTxForLedger = {
  trans_date: string;
  direction: string;
  amount: number;
  description: string | null;
  matched_client_id: string | null;
  matched_client_name_raw: string | null;
  bank_accounts?: { nickname: string | null; bank_name: string } | null;
  clients?: { name: string } | null;
};

/** 출금이면 매입, 입금이면 매출 — 결제방식은 따로(`payment_method_id`, 등록할 때 송금을 찾아 넣음) */
export function ledgerRowFromBank(bankTx: BankTxForLedger) {
  const isPurchase = bankTx.direction === "출금";
  const accountName = bankTx.bank_accounts?.nickname ?? bankTx.bank_accounts?.bank_name ?? "";
  // 매칭 거래처 이름을 품목으로 — 매칭 거래처가 없으면 내용(적요)으로 대신한다.
  const matchedClientName = bankTx.clients?.name ?? bankTx.matched_client_name_raw ?? null;
  return {
    trans_date: bankTx.trans_date,
    type: isPurchase ? "매입" : "매출",
    client_id: bankTx.matched_client_id,
    client_name_raw: bankTx.matched_client_name_raw,
    item_name: matchedClientName ?? bankTx.description,
    purchase_amount: isPurchase ? bankTx.amount : 0,
    purchase_vat: 0,
    sales_amount: isPurchase ? 0 : bankTx.amount,
    sales_vat: 0,
    payment_type: "immediate",
    vat_included: false,
    tax_invoice_issued: false,
    needs_classification: true,
    note1: `[은행] ${accountName}${bankTx.description ? ` · ${bankTx.description}` : ""}`,
  };
}

// 등록 때 비워 두는 칸 — 하나라도 채워져 있으면 장부에서 분류·수정한 것
const LEFT_EMPTY = ["project_id", "category_id", "note2", "quantity", "unit_price"] as const;

/**
 * 자동 등록된 장부 줄이 등록 당시 그대로인지 — 등록 때 넣은 값(`ledgerRowFromBank`)과 모든 칸이 같고, 비워 둔 칸도 여전히 비어
 * 있을 때만 true. 결제방식은 송금(`remitMethodId` — 11/12부터 등록 때 넣음) 또는 빈칸(그 전에 올린 줄)이면 그대로로 봄 — 송금을
 * 찾지 못하면(이름을 바꿈·조회 실패) 빈칸만. 하나라도 다르면 장부에서 손댄 것이라 은행 쪽 취소·삭제와 함께 지우지 않음.
 */
export function isLedgerRowUntouched(
  ledger: Record<string, unknown>,
  bankTx: BankTxForLedger,
  remitMethodId: string | null
): boolean {
  const expected = ledgerRowFromBank(bankTx);
  const sameValue = (a: unknown, b: unknown) => (typeof b === "number" ? Number(a) === b : (a ?? null) === (b ?? null));
  const unchanged = (Object.keys(expected) as (keyof typeof expected)[]).every((k) => sameValue(ledger[k], expected[k]));
  const stillEmpty = LEFT_EMPTY.every((k) => ledger[k] === null || ledger[k] === undefined);
  const method = ledger.payment_method_id ?? null;
  const methodAsRegistered = method === null || (remitMethodId !== null && method === remitMethodId);
  return unchanged && stillEmpty && methodAsRegistered;
}
