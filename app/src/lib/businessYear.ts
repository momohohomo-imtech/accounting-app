// 사업 첫해(대시보드 "○년 주요 납부 예정(사업 첫해)") — 첫 매출이 있는 해(11/4 점검: 예전엔 앱의 가장 이른 거래 연도라, 준비기간
// 매입처럼 지난 해 날짜 거래를 하나라도 넣으면 올해 첫해 칸이 사라졌음). 매출이 없던 해(준비기간)는 소득세가 없어 다음 해 11월
// 중간예납도 없으므로 첫 매출이 있는 해를 첫해로 봄. 매출이 아직 없으면 올해. 검사: businessYear.test.ts.
export function firstBusinessYear(firstSaleDate: string | null | undefined, currentYear: number) {
  const year = firstSaleDate ? Number(firstSaleDate.slice(0, 4)) : currentYear;
  return Math.min(year, currentYear);
}

// 첫해 사업 기간(대표자 건강보험 정산·보험료 개월 수) — 그 해 첫 거래(매출·매입 무관) 달부터 12월까지. 그 해 거래가 없으면 12개월.
export function businessMonthsIn(yearDates: string[]) {
  const first = yearDates.reduce<string | null>((min, d) => (min === null || d < min ? d : min), null);
  const startMonth = first ? Number(first.slice(5, 7)) : 1;
  return { startMonth, months: 12 - startMonth + 1 };
}
