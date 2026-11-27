// 매입매출 등록의 품목 줄 — 프로젝트·카테고리·결제수단은 품목이 1줄이면 위쪽 공통 칸, 2줄 이상이면 줄마다(카테고리·결제수단은
// 11/27 사용자 요청 "여러 항목 추가 시 카테고리·결제수단 각기 선택 — 프로젝트처럼"). 줄 수가 바뀔 때 공통 칸 ↔ 줄 값을 옮기는 규칙,
// 저장할 때 줄마다 쓸 값, 비과세 카테고리 줄의 VAT·세금계산서는 여기로만(TransactionForm). 검사: transactionLines.test.ts
export type LineCommons = { project_id: string; category_id: string; payment_method_id: string };

export const EMPTY_LINE_COMMONS: LineCommons = { project_id: "", category_id: "", payment_method_id: "" };

/**
 * 줄이 2개 이상이 되면 공통 칸 값을 빈 줄에 옮겨 적고 공통 칸은 비움(그때부터 줄의 빈 값 = 프로젝트는 일반경비, 카테고리·결제수단은
 * 선택 안 함), 1줄로 돌아오면 그 줄 값을 다시 공통 칸으로. 줄을 추가한 뒤 위쪽 칸을 바꾸면 "(공통)" 줄까지 같이 바뀌어 원래 프로젝트에서
 * 거래가 빠졌던 것(사용자 문의) — 그래서 2줄부터는 위쪽 칸을 숨기고 줄마다 고름.
 */
export function splitLineCommons<L extends LineCommons>(lines: L[], common: LineCommons): { lines: L[]; common: LineCommons } {
  if (lines.length > 1) {
    return {
      lines: lines.map((li) => ({
        ...li,
        project_id: li.project_id || common.project_id,
        category_id: li.category_id || common.category_id,
        payment_method_id: li.payment_method_id || common.payment_method_id,
      })),
      common: { ...EMPTY_LINE_COMMONS },
    };
  }
  if (lines.length === 1) {
    const only = lines[0];
    return {
      lines: [{ ...only, project_id: "", category_id: "", payment_method_id: "" }],
      common: {
        project_id: only.project_id || common.project_id,
        category_id: only.category_id || common.category_id,
        payment_method_id: only.payment_method_id || common.payment_method_id,
      },
    };
  }
  return { lines, common };
}

/**
 * 저장할 때 줄의 프로젝트·카테고리·결제수단. 프로젝트는 줄 값, 없으면 공통(1줄일 때도 줄 칸에서 따로 고른 프로젝트가 우선 — 예전 그대로).
 * 카테고리·결제수단은 2줄 이상이면 줄 값만(위쪽 칸은 숨겨져 있어 화면에 안 보이는 값을 쓰지 않게), 1줄이면 공통 칸.
 */
export function resolveLineCommons(li: LineCommons, common: LineCommons, perLine: boolean): LineCommons {
  return {
    project_id: li.project_id || common.project_id,
    category_id: perLine ? li.category_id : li.category_id || common.category_id,
    payment_method_id: perLine ? li.payment_method_id : li.payment_method_id || common.payment_method_id,
  };
}

/** 줄의 VAT 추가·세금계산서 — 비과세 카테고리 줄은 위쪽 체크와 상관없이 둘 다 끔(1줄일 때·일괄 변경과 같은 규칙: 비과세는 세금계산서 없음) */
export function lineTaxFlags(exempt: boolean, form: { vat_included: boolean; tax_invoice_issued: boolean }) {
  return { vat_included: !exempt && form.vat_included, tax_invoice_issued: !exempt && form.tax_invoice_issued };
}

/**
 * 한 결제로 묶인 줄을 한꺼번에 수정할 때 위쪽 VAT 추가·세금계산서 체크 = 비과세가 아닌 줄의 값(묶음 전체 수정은 그 줄들끼리 같을 때만 열림 —
 * lib/paymentGroup.ts의 sameCommonFields), 모두 비과세면 끔. 누른 줄이 비과세 줄이면 그 줄 값(늘 꺼짐)으로 열려, 저장할 때 다른 줄의
 * 부가세가 빠졌을 것.
 */
export function groupTaxFlags<T extends { vat_included: boolean; tax_invoice_issued: boolean }>(lines: T[], isExempt: (line: T) => boolean) {
  const taxed = lines.find((l) => !isExempt(l));
  return { vat_included: taxed?.vat_included ?? false, tax_invoice_issued: taxed?.tax_invoice_issued ?? false };
}

/** 거래처 기본 카테고리 — 줄마다 고르는 중이면 카테고리가 빈 줄에만 넣음(이미 고른 줄은 그대로) */
export function fillEmptyCategory<L extends { category_id: string }>(lines: L[], categoryId: string): L[] {
  return lines.map((li) => (li.category_id ? li : { ...li, category_id: categoryId }));
}

/** 줄들에 고른 결제수단 종류 수(빈 칸 빼고) — 둘 이상인데 "한 결제로 묶기"면 따로 결제한 것일 수 있어 알림 */
export function distinctPaymentMethodCount(lines: { payment_method_id: string }[]) {
  return new Set(lines.map((l) => l.payment_method_id).filter(Boolean)).size;
}
