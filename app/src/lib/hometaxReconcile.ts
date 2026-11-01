// 홈택스 전자세금계산서 목록(엑셀) ↔ 매입매출 대조(10/31 사용자 "전부" — 추천 기능, 검사: hometaxReconcile.test.ts).
// 홈택스 "전자(세금)계산서 → 목록조회 → 엑셀 내려받기" 파일을 화면에서 읽어(밖으로 보내지 않음) 그 기간 매출 또는 매입과 맞춰 봄:
//  - 일치: 같은 작성일자·같은 금액(공급가액+세액, 원 단위 반올림 차이 허용) — 거래처가 같은 것을 먼저, 한 결제 묶음·같은 날 같은
//    거래처로 나눠 적은 거래는 합쳐서 비교
//  - 홈택스에만 있음: 앱에 안 적었거나 날짜·금액이 크게 다른 계산서
//  - 앱에만 있음: 앱에 "세금계산서 발행"으로 적었는데 홈택스에 없는 거래
//  - 날짜·금액 다름: 거래처가 같은데 날짜만 다르거나(45일 안) 같은 날인데 금액이 다른 것
//  - 세금계산서 표시 빠짐: 홈택스 계산서와 맞는데 앱 거래에 "세금계산서 발행" 체크가 없는 것
import { parseExcelDate, parseExcelNumber } from "@/lib/transactionExcel";

export type InvoiceKind = "매출" | "매입";

export type HometaxInvoice = {
  /** 엑셀 줄 번호(1부터) — 원본에서 찾기 쉽게 */
  row: number;
  date: string;
  approvalNo: string;
  counterparty: string;
  counterpartyBizNo: string;
  supply: number;
  tax: number;
  total: number;
  item: string;
};

export type AppInvoiceTx = {
  id: string;
  date: string;
  client: string;
  clientBizNo: string;
  supply: number;
  tax: number;
  taxInvoice: boolean;
  groupId: string | null;
  item: string | null;
};

const norm = (s: string) => s.replace(/\(.*?\)/g, "").replace(/\s+/g, "");
const digits = (s: string) => s.replace(/\D/g, "");

/** 홈택스 목록 표(줄 × 칸 글자) → 계산서. 머리글 줄(작성일자·공급가액이 있는 줄)을 위쪽 15줄에서 찾음. */
export function parseHometaxSheet(
  table: string[][],
  kind: InvoiceKind
): { invoices: HometaxInvoice[]; detectedKind: InvoiceKind | null; error: string | null } {
  const rows = table.map((r) => r.map((c) => (c ?? "").toString().trim()));
  const headerIndex = rows.slice(0, 15).findIndex((r) => {
    const cells = r.map(norm);
    return cells.includes("작성일자") && (cells.includes("공급가액") || cells.includes("합계금액"));
  });
  if (headerIndex < 0) {
    return {
      invoices: [],
      detectedKind: null,
      error: "홈택스 전자세금계산서 목록 파일이 아닌 것 같습니다(작성일자·공급가액 머리글을 찾지 못함).",
    };
  }
  const title = rows.slice(0, headerIndex).flat().join(" ");
  const detectedKind: InvoiceKind | null = /매출/.test(title) ? "매출" : /매입/.test(title) ? "매입" : null;

  const header = rows[headerIndex].map(norm);
  const col = (name: string, from = 0) => header.findIndex((h, i) => i >= from && h === name);
  const supplierBizCol = header.findIndex((h) => /^공급자(사업자)?등록번호$/.test(h));
  const buyerBizCol = header.findIndex((h) => /^공급받는자(사업자)?등록번호$/.test(h));
  // 상호 칸이 두 개(공급자·공급받는자) — 이름이 따로 붙어 있으면 그 칸, 아니면 등록번호 칸 뒤의 첫 "상호".
  const nameCol = (who: "공급자" | "공급받는자", bizCol: number) => {
    const explicit = header.findIndex((h) => h === `${who}상호`);
    if (explicit >= 0) return explicit;
    return bizCol >= 0 ? col("상호", bizCol + 1) : -1;
  };
  const supplierNameCol = nameCol("공급자", supplierBizCol);
  const buyerNameCol = nameCol("공급받는자", buyerBizCol);
  const cpNameCol = kind === "매출" ? buyerNameCol : supplierNameCol;
  const cpBizCol = kind === "매출" ? buyerBizCol : supplierBizCol;
  const dateCol = col("작성일자");
  const approvalCol = col("승인번호");
  const supplyCol = col("공급가액");
  const taxCol = col("세액");
  const totalCol = col("합계금액");
  const itemCol = col("품목명");

  const defaultYear = new Date().getFullYear();
  const seen = new Set<string>();
  const invoices: HometaxInvoice[] = [];
  rows.slice(headerIndex + 1).forEach((r, i) => {
    const get = (c: number) => (c >= 0 ? (r[c] ?? "") : "");
    const date = parseExcelDate(get(dateCol), defaultYear);
    if (!date) return; // 합계·안내 줄
    const approvalNo = get(approvalCol);
    // "품목 포함"으로 받으면 계산서 한 장이 품목 수만큼 여러 줄 — 승인번호로 한 번만(금액은 계산서 기준이라 줄마다 같음).
    if (approvalNo) {
      if (seen.has(approvalNo)) return;
      seen.add(approvalNo);
    }
    const supply = parseExcelNumber(get(supplyCol));
    const tax = parseExcelNumber(get(taxCol)) ?? 0;
    const total = parseExcelNumber(get(totalCol)) ?? (supply ?? 0) + tax;
    invoices.push({
      row: headerIndex + 2 + i,
      date,
      approvalNo,
      counterparty: get(cpNameCol),
      counterpartyBizNo: digits(get(cpBizCol)),
      supply: supply ?? total - tax,
      tax,
      total,
      item: get(itemCol),
    });
  });
  return { invoices, detectedKind, error: invoices.length === 0 ? "파일에서 계산서 줄을 찾지 못했습니다." : null };
}

function sameCounterparty(inv: { counterparty: string; counterpartyBizNo: string }, tx: { client: string; clientBizNo: string }) {
  if (inv.counterpartyBizNo && tx.clientBizNo) return inv.counterpartyBizNo === digits(tx.clientBizNo);
  const a = norm(inv.counterparty).replace(/주식회사|㈜|유한회사/g, "").toLowerCase();
  const b = norm(tx.client).replace(/주식회사|㈜|유한회사/g, "").toLowerCase();
  if (a.length < 2 || b.length < 2) return false;
  return a === b || a.includes(b) || b.includes(a);
}

// 금액이 같은지 — 합계는 1원, 공급가액은 10원까지(앱이 합계에서 부가세를 나누며 생기는 반올림 차이).
function sameAmount(inv: { supply: number; total: number }, supply: number, tax: number) {
  return Math.abs(inv.total - (supply + tax)) <= 1 && Math.abs(inv.supply - supply) <= 10;
}

const dayNumber = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / 86_400_000;
export const NEAR_DATE_DAYS = 45;

export type ReconcileResult = {
  matched: { invoice: HometaxInvoice; txIds: string[] }[];
  hometaxOnly: HometaxInvoice[];
  appOnly: AppInvoiceTx[];
  mismatched: { invoice: HometaxInvoice; tx: AppInvoiceTx; reason: "날짜 다름" | "금액 다름" }[];
  missingFlag: AppInvoiceTx[];
};

/** appTxs: 그 종류(매출 또는 매입) 거래 — 기간 앞뒤 45일까지 넘기면 날짜가 조금 다른 것도 찾음. period: 앱에만 있음을 셀 기간. */
export function reconcileHometax(
  invoices: HometaxInvoice[],
  appTxs: AppInvoiceTx[],
  period: { start: string; end: string }
): ReconcileResult {
  const used = new Set<string>();
  const result: ReconcileResult = { matched: [], hometaxOnly: [], appOnly: [], mismatched: [], missingFlag: [] };
  const free = (t: AppInvoiceTx) => !used.has(t.id);
  const take = (inv: HometaxInvoice, txs: AppInvoiceTx[]) => {
    txs.forEach((t) => used.add(t.id));
    result.matched.push({ invoice: inv, txIds: txs.map((t) => t.id) });
  };
  const groups = new Map<string, AppInvoiceTx[]>();
  for (const t of appTxs) if (t.groupId) groups.set(t.groupId, [...(groups.get(t.groupId) ?? []), t]);
  const sum = (txs: AppInvoiceTx[]) => ({
    supply: txs.reduce((s, t) => s + t.supply, 0),
    tax: txs.reduce((s, t) => s + t.tax, 0),
  });

  const sorted = [...invoices].sort((a, b) => a.date.localeCompare(b.date) || a.row - b.row);
  // 1차: 같은 날·같은 금액을 단계별로 — 거래처까지 같은 한 건 → 한 결제 묶음 합계 → 같은 날 같은 거래처 여러 건 합계 →
  // 거래처 이름이 달라도 같은 날·같은 금액 한 건(거래처가 같은 것을 다 맞춘 뒤라 엉뚱한 짝이 덜 생김).
  const steps: ((inv: HometaxInvoice) => AppInvoiceTx[] | null)[] = [
    (inv) => {
      const t = appTxs.find((t) => free(t) && t.date === inv.date && sameAmount(inv, t.supply, t.tax) && sameCounterparty(inv, t));
      return t ? [t] : null;
    },
    (inv) =>
      [...groups.values()].find((g) => {
        if (!g.every((t) => free(t) && t.date === inv.date)) return false;
        const s = sum(g);
        return sameAmount(inv, s.supply, s.tax);
      }) ?? null,
    (inv) => {
      const sameClient = appTxs.filter((t) => free(t) && t.date === inv.date && sameCounterparty(inv, t));
      if (sameClient.length < 2) return null;
      const s = sum(sameClient);
      return sameAmount(inv, s.supply, s.tax) ? sameClient : null;
    },
    (inv) => {
      const t = appTxs.find((t) => free(t) && t.date === inv.date && sameAmount(inv, t.supply, t.tax));
      return t ? [t] : null;
    },
  ];
  let remaining = sorted;
  for (const step of steps) {
    const next: HometaxInvoice[] = [];
    for (const inv of remaining) {
      const hit = step(inv);
      if (hit) take(inv, hit);
      else next.push(inv);
    }
    remaining = next;
  }
  const pending = remaining;
  // 2차: 남은 계산서 — 같은 거래처·같은 금액인데 날짜만 다른 것, 같은 날 같은 거래처인데 금액이 다른 것
  for (const inv of pending) {
    const near = appTxs
      .filter(
        (t) =>
          free(t) &&
          sameCounterparty(inv, t) &&
          sameAmount(inv, t.supply, t.tax) &&
          Math.abs(dayNumber(t.date) - dayNumber(inv.date)) <= NEAR_DATE_DAYS
      )
      .sort((a, b) => Math.abs(dayNumber(a.date) - dayNumber(inv.date)) - Math.abs(dayNumber(b.date) - dayNumber(inv.date)))[0];
    if (near) {
      used.add(near.id);
      result.mismatched.push({ invoice: inv, tx: near, reason: "날짜 다름" });
      continue;
    }
    const sameDayClient = appTxs.find((t) => free(t) && t.date === inv.date && sameCounterparty(inv, t));
    if (sameDayClient) {
      used.add(sameDayClient.id);
      result.mismatched.push({ invoice: inv, tx: sameDayClient, reason: "금액 다름" });
      continue;
    }
    result.hometaxOnly.push(inv);
  }
  // 단계별로 짝지은 순서 대신 계산서 날짜 순으로
  result.matched.sort((a, b) => a.invoice.date.localeCompare(b.invoice.date) || a.invoice.row - b.invoice.row);
  const matchedIds = new Set(result.matched.flatMap((m) => m.txIds));
  result.missingFlag = appTxs.filter((t) => matchedIds.has(t.id) && !t.taxInvoice);
  result.appOnly = appTxs.filter((t) => !used.has(t.id) && t.taxInvoice && t.date >= period.start && t.date <= period.end);
  return result;
}
