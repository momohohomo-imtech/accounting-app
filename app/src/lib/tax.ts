export const INCOME_TAX_BRACKETS = [
  { upTo: 14_000_000, rate: 0.06, deduction: 0 },
  { upTo: 50_000_000, rate: 0.15, deduction: 1_260_000 },
  { upTo: 88_000_000, rate: 0.24, deduction: 5_760_000 },
  { upTo: 150_000_000, rate: 0.35, deduction: 15_440_000 },
  { upTo: 300_000_000, rate: 0.38, deduction: 19_940_000 },
  { upTo: 500_000_000, rate: 0.4, deduction: 25_940_000 },
  { upTo: 1_000_000_000, rate: 0.42, deduction: 35_940_000 },
  { upTo: Infinity, rate: 0.45, deduction: 65_940_000 },
];

export function estimateIncomeTax(taxBase: number) {
  if (taxBase <= 0) return 0;
  const bracket = INCOME_TAX_BRACKETS.find((b) => taxBase <= b.upTo)!;
  return Math.max(Math.round(taxBase * bracket.rate - bracket.deduction), 0);
}

export function currentBracketIndex(taxBase: number) {
  return INCOME_TAX_BRACKETS.findIndex((b) => taxBase <= b.upTo);
}

// 종합소득공제 중 본인 기본공제만 반영 — 그 밖의 공제와 매입장에 없는 경비는 세무사가 신고 때 반영해서
// 실제 세액은 이 추정과 다름.
export const BASIC_DEDUCTION = 1_500_000;

// 중간예납·부가세 예정고지는 고지할 금액이 50만원 미만이면 고지하지 않음.
export const MIN_NOTICE_AMOUNT = 500_000;

// 개인사업자 종합소득세 추정 — 이익에서 본인 기본공제를 뺀 과세표준 기준(0 이하면 0), 지방소득세(소득세의 10%) 포함.
export function taxEstimate(profit: number) {
  const taxBase = Math.max(profit - BASIC_DEDUCTION, 0);
  const incomeTax = estimateIncomeTax(taxBase);
  const localTax = Math.round(incomeTax * 0.1);
  const bracket = INCOME_TAX_BRACKETS[currentBracketIndex(taxBase)];
  return { taxBase, incomeTax, localTax, totalTax: incomeTax + localTax, ratePct: Math.round(bracket.rate * 100) };
}

// 종합소득세 분납: 납부할 소득세가 1천만원을 넘으면 일부를 2개월 안(7월 말)에 나눠 낼 수 있음 —
// 2천만원 이하면 1천만원 넘는 부분, 2천만원 넘으면 절반까지.
export function incomeTaxInstallment(incomeTax: number) {
  if (incomeTax > 20_000_000) return Math.floor(incomeTax / 2);
  if (incomeTax > 10_000_000) return incomeTax - 10_000_000;
  return 0;
}

// 직전 세액의 절반을 고지 — 50만원 미만이면 고지 없음(0).
function halfNotice(prevTax: number) {
  const half = Math.floor(Math.max(prevTax, 0) / 2);
  return half < MIN_NOTICE_AMOUNT ? 0 : half;
}

// 다음 해 11월 중간예납 — 직전 해 납부 소득세의 절반(사업 첫해에는 중간예납이 없어서 둘째 해부터).
export function interimPrepayment(incomeTax: number) {
  return halfNotice(incomeTax);
}

// 부가세 예정고지(개인 일반과세자) — 4월·10월에 직전 반기(2기·1기) 납부세액의 절반을 고지하고, 고지된 금액은
// 그 반기 확정신고(7월·1월) 때 빼고 냄.
export function vatPrepaymentNotice(prevHalfVat: number) {
  return halfNotice(prevHalfVat);
}
