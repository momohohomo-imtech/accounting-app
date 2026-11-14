// 대표자(개인사업자, 직원 있음 → 국민연금 사업장 사용자·건강보험 직장 대표자) 본인이 내년에 낼 보험료 추정.
// 올해 사업소득(이익)이 내년 5월 종합소득세 신고 후 보험료 기준에 반영되고, 대표자는 사용자 몫까지 전액 본인 부담.
// 월 기준 소득 = 올해 이익 ÷ 올해 사업 기간(개월).
//
// 요율은 연도별 표(insuranceRatesFor) — 예전엔 2027년 값 하나만 있어서, 해가 바뀌면 다음 해 추정에도 지난 요율이 조용히 쓰였음.
// 해마다 새 요율이 정해지면(건강보험 8~9월, 장기요양 10~11월, 국민연금 상·하한 3월 고시·7월 적용) 아래 표에 한 줄씩 추가할 것.
// 아직 안 정해진 해는 가장 최근 값으로 추정하고 화면에 "미확정 — ○○년 요율 적용"으로 표시(estimated).

// 국민연금 보험료율은 법으로 정해진 일정(2025년 3월 연금개혁: 2026년 9.5%부터 매년 0.5%p씩 올려 2033년 13%).
export function pensionRateFor(year: number) {
  const permille = Math.min(130, Math.max(90, 90 + 5 * (year - 2025)));
  return permille / 1000;
}

// 기준소득월액 상·하한 — 그 해 7월 ~ 다음 해 6월 적용(키 = 7월이 속한 해).
const PENSION_LIMITS_FROM_JULY: Record<number, { cap: number; floor: number }> = {
  2025: { cap: 6_370_000, floor: 400_000 },
  2026: { cap: 6_590_000, floor: 410_000 },
};
// 건강보험료율(직장).
const HEALTH_RATE: Record<number, number> = {
  2025: 0.0709,
  2026: 0.0719,
  2027: 0.0719, // 2027 동결(2026년 9월 결정)
};
// 장기요양보험료 = 건강보험료의 이 비율(2026: 소득 대비 0.9448% = 건강보험료 대비 13.14%).
const LONG_TERM_CARE_OF_HEALTH: Record<number, number> = {
  2025: 0.1295,
  2026: 0.1314,
  2027: 0.139, // 2027: 소득 대비 0.9994% = 건강보험료 대비 13.90%(2026년 10월 30일 장기요양위원회 결정)
};

export type EstimatedRate = { item: "pensionLimits" | "health" | "longTermCare"; fromYear: number };

export type InsuranceRates = {
  year: number;
  pensionRate: number;
  pensionMonthlyCap: number;
  pensionMonthlyFloor: number;
  /** 상·하한을 가져온 기간(그 해 7월 ~ 다음 해 6월)의 시작 연도 */
  pensionLimitsFromJuly: number;
  healthRate: number;
  longTermCareOfHealth: number;
  /** 그 해 값이 아직 없어 다른 해 값으로 추정한 항목 */
  estimated: EstimatedRate[];
};

// 그 해 값(없으면 그 전 가장 최근 값, 그것도 없으면 가장 이른 값)과 실제로 쓴 해.
function pick<T>(table: Record<number, T>, year: number): { value: T; fromYear: number } {
  const years = Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b);
  const fromYear = [...years].reverse().find((y) => y <= year) ?? years[0];
  return { value: table[fromYear], fromYear };
}

/** 그 해(1~12월) 대표자 보험료 추정에 쓸 요율. 상·하한은 그 해 1~6월에 적용되는 전년 7월 기준. */
export function insuranceRatesFor(year: number): InsuranceRates {
  const limits = pick(PENSION_LIMITS_FROM_JULY, year - 1);
  const health = pick(HEALTH_RATE, year);
  const care = pick(LONG_TERM_CARE_OF_HEALTH, year);
  const estimated: EstimatedRate[] = [];
  if (limits.fromYear !== year - 1) estimated.push({ item: "pensionLimits", fromYear: limits.fromYear });
  if (health.fromYear !== year) estimated.push({ item: "health", fromYear: health.fromYear });
  if (care.fromYear !== year) estimated.push({ item: "longTermCare", fromYear: care.fromYear });
  return {
    year,
    pensionRate: pensionRateFor(year),
    pensionMonthlyCap: limits.value.cap,
    pensionMonthlyFloor: limits.value.floor,
    pensionLimitsFromJuly: limits.fromYear,
    healthRate: health.value,
    longTermCareOfHealth: care.value,
    estimated,
  };
}

const ESTIMATED_LABEL: Record<EstimatedRate["item"], string> = {
  pensionLimits: "국민연금 기준소득월액 상·하한",
  health: "건강보험",
  longTermCare: "장기요양",
};

/** 화면 안내 — 추정한 항목이 없으면 빈 문자열. 예: "장기요양 2027년 요율 미확정 — 2026년 요율 적용" */
export function estimatedRatesNote(rates: InsuranceRates) {
  return rates.estimated
    .map((e) =>
      e.item === "pensionLimits"
        ? `${ESTIMATED_LABEL[e.item]} ${rates.year - 1}년 7월 고시 전 — ${e.fromYear}년 7월 기준 적용`
        : `${ESTIMATED_LABEL[e.item]} ${rates.year}년 요율 미확정 — ${e.fromYear}년 요율 적용`
    )
    .join(" · ");
}

const floor10 = (n: number) => Math.floor(n / 10) * 10;

function pensionMonthlyAt(monthlyIncome: number, rate: number, rates: InsuranceRates) {
  if (monthlyIncome <= 0) return 0;
  const base = Math.min(Math.max(monthlyIncome, rates.pensionMonthlyFloor), rates.pensionMonthlyCap);
  return floor10(Math.floor(base / 1000) * 1000 * rate);
}

function healthMonthlyAt(monthlyIncome: number, rates: InsuranceRates) {
  const healthOnly = floor10(Math.max(monthlyIncome, 0) * rates.healthRate);
  return healthOnly + floor10(healthOnly * rates.longTermCareOfHealth);
}

export function estimateOwnerInsurance(annualProfit: number, months: number, rates: InsuranceRates) {
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
export function ownerHealthSettlement(annualProfit: number, months: number, paidMonthly: number, rates: InsuranceRates) {
  const owedMonthly = healthMonthlyAt(Math.max(annualProfit, 0) / Math.max(months, 1), rates);
  return (owedMonthly - paidMonthly) * months;
}
