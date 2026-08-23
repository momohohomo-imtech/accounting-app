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
