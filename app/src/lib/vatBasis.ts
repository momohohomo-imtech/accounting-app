import { VAT_EXEMPT_CATEGORIES } from "@/lib/vatExempt";
import { one } from "@/lib/relations";
import { transactionTotal } from "@/lib/credit";

// 부가세 계산 기준(앱 전체 공통): 거래에 저장된 공급가 칸 + 부가세 칸을 합친 "총액"은 항상
// 부가세 포함 금액으로 본다 — 등록 화면의 VAT 체크는 여러 품목에 10%를 한 번에 붙이는 입력
// 편의 기능일 뿐이라, 두 칸에 어떻게 나눠 저장됐는지는 의미가 없음.
//  - 비과세 카테고리(인건비 등): 총액 전체가 공급가, 부가세 0
//  - 그 외: 공급가 = 총액 ÷ 1.1(반올림), 부가세 = 총액 − 공급가
// 저장된 값은 절대 바꾸지 않고, 계산·표시할 때만 이 함수들로 나눈다.

type CategoryInfo = { name: string; vat_exempt?: boolean | null; vat_non_deductible?: boolean | null };
type CategoryRel = CategoryInfo | CategoryInfo[] | null | undefined;

export type VatBasisRow = {
  type: string;
  sales_amount: number;
  sales_vat: number;
  purchase_amount: number;
  purchase_vat: number;
  expense_categories?: CategoryRel;
};

// 지출카테고리의 "비과세" 체크로 판단. 083 SQL 실행 전이라 칸 자체가 없을 때만 예전처럼 이름으로.
export function isVatExemptCategory(category: CategoryInfo | null | undefined) {
  if (!category) return false;
  if (category.vat_exempt === undefined) return VAT_EXEMPT_CATEGORIES.includes(category.name);
  return Boolean(category.vat_exempt);
}

export function supplyOf(row: VatBasisRow) {
  const gross = transactionTotal(row);
  return isVatExemptCategory(one(row.expense_categories)) ? gross : Math.round(gross / 1.1);
}

export function vatOf(row: VatBasisRow) {
  return transactionTotal(row) - supplyOf(row);
}

export function salesSupplyOf(row: VatBasisRow) {
  return row.type === "매출" ? supplyOf(row) : 0;
}

// 이익·소득세 계산용 매입 비용 — 돌려받는 부가세만 뺀다. 매입세액 불공제 카테고리(승용차 렌트·
// 유류비 등, 지출카테고리에서 체크)는 부가세를 못 돌려받으니 총액 전체가 비용.
export function purchaseCostOf(row: VatBasisRow) {
  if (row.type !== "매입") return 0;
  return one(row.expense_categories)?.vat_non_deductible ? transactionTotal(row) : supplyOf(row);
}
