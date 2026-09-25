// 대표자(개인사업자, 직원 있음 → 국민연금 사업장 사용자·건강보험 직장 대표자) 본인이 내년에 낼 보험료 추정.
// 올해 사업소득(이익)이 내년 5월 종합소득세 신고 후 보험료 기준에 반영되고, 대표자는 사용자 몫까지 전액 본인 부담.
// 월 기준 소득 = 올해 이익 ÷ 올해 사업 기간(개월). 요율·상한은 매년 바뀌니 해마다 여기만 고칠 것.
export const OWNER_INSURANCE_RATES = {
  year: 2027,
  pensionRate: 0.1, // 국민연금 2026 9.5% → 2027 10% (연금개혁: 매년 0.5%p씩 2033년 13%)
  pensionRateThisYear: 0.095, // 2026 요율 — 가입 누락 시 올해분 소급 추정용
  pensionMonthlyCap: 6_590_000, // 기준소득월액 상한 (2026.7~2027.6)
  pensionMonthlyFloor: 410_000, // 기준소득월액 하한 (2026.7~2027.6)
  healthRate: 0.0719, // 건강보험 2026·2027 모두 7.19% (2027 동결 확정)
  longTermCareOfHealth: 0.1314, // 장기요양 = 건강보험료의 13.14% (2026 요율 — 2027분은 2026년 10월 이후 결정)
};

const floor10 = (n: number) => Math.floor(n / 10) * 10;

function pensionMonthlyAt(monthlyIncome: number, rate: number, rates: typeof OWNER_INSURANCE_RATES) {
  if (monthlyIncome <= 0) return 0;
  const base = Math.min(Math.max(monthlyIncome, rates.pensionMonthlyFloor), rates.pensionMonthlyCap);
  return floor10(Math.floor(base / 1000) * 1000 * rate);
}

function healthMonthlyAt(monthlyIncome: number, rates: typeof OWNER_INSURANCE_RATES) {
  const healthOnly = floor10(Math.max(monthlyIncome, 0) * rates.healthRate);
  return healthOnly + floor10(healthOnly * rates.longTermCareOfHealth);
}

export function estimateOwnerInsurance(annualProfit: number, months = 12, rates = OWNER_INSURANCE_RATES) {
  const monthlyIncome = Math.max(annualProfit, 0) / Math.max(months, 1);
  const pensionMonthly = pensionMonthlyAt(monthlyIncome, rates.pensionRate, rates);
  const healthMonthly = healthMonthlyAt(monthlyIncome, rates);
  return {
    pensionMonthly,
    pensionYearly: pensionMonthly * 12,
    healthMonthly,
    healthYearly: healthMonthly * 12,
  };
}

// 사업 첫해 대표자 건강보험은 최고 급여 직원 기준으로 임시로 내고, 이듬해 5월 종합소득세 신고 뒤 올해 실제
// 이익으로 다시 계산해 차액을 한꺼번에 청구(분할납부 가능). paidMonthly = 올해 매달 낸 대표자 건강보험료(장기요양 포함).
export function ownerHealthSettlement(annualProfit: number, months: number, paidMonthly: number, rates = OWNER_INSURANCE_RATES) {
  const owedMonthly = healthMonthlyAt(Math.max(annualProfit, 0) / Math.max(months, 1), rates);
  return (owedMonthly - paidMonthly) * months;
}

// 대표자 국민연금이 가입 누락돼 있으면 사업 시작 때로 거슬러 부과될 수 있는 올해분(올해 요율) — 확인용 추정.
export function ownerPensionBackPay(annualProfit: number, months: number, rates = OWNER_INSURANCE_RATES) {
  const monthlyIncome = Math.max(annualProfit, 0) / Math.max(months, 1);
  return pensionMonthlyAt(monthlyIncome, rates.pensionRateThisYear, rates) * months;
}
