// 비과세는 지출카테고리의 "비과세"(vat_exempt) 체크로 판단한다 — 이 이름 목록은 083 SQL 실행 전
// (칸이 아직 없을 때)의 대체 기준으로만 쓰인다(lib/vatBasis.ts isVatExemptCategory).
// 직원 급여/상여/4대보험 지출은 employees/payroll 관리 화면이 아니라 매입매출장에 이 카테고리로
// 찍힌 매입 기준으로 집계한다(대시보드 이익 예상·보고서 예상 순이익율 공통).
export const PAYROLL_CATEGORY_NAME = "직원급여/상여/4대보험";

export const VAT_EXEMPT_CATEGORIES = ["인건비", PAYROLL_CATEGORY_NAME, "면세"];
