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

// 개인사업자 종합소득세 추정 — 이익이 0 이하면 0, 지방소득세(소득세의 10%) 포함.
export function taxEstimate(profit: number) {
  const taxBase = Math.max(profit, 0);
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

// 다음 해 11월 중간예납 — 직전 해 납부 소득세의 절반(사업 첫해에는 중간예납이 없어서 둘째 해부터).
export function interimPrepayment(incomeTax: number) {
  return Math.floor(Math.max(incomeTax, 0) / 2);
}
