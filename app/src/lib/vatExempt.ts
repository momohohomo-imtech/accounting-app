// 이 종류구분들은 부가세 대상이 아님 — 등록 화면에서 VAT/세금계산서 체크를 막고,
// 저장 시에도 세액을 아예 0으로 처리해서 이중으로 세금이 붙지 않게 함.
// 직원 급여/상여/4대보험 지출은 employees/payroll 관리 화면이 아니라 매입매출장에 이 카테고리로
// 찍힌 매입 기준으로 집계한다(대시보드 이익 예상·보고서 예상 순이익율 공통).
export const PAYROLL_CATEGORY_NAME = "직원급여/상여/4대보험";

export const VAT_EXEMPT_CATEGORIES = ["인건비", PAYROLL_CATEGORY_NAME, "면세"];
