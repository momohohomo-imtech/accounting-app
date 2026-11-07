// 매입매출장 글자 검색(사용자 요청 11/7 "추가 2") — 지금 고른 기간·필터의 거래 안에서 거래처·품목·메모(메모1·2)·프로젝트·카테고리
// 글자로 찾음. 띄어 쓴 낱말은 모두 들어 있어야 하고(그리고), 띄어쓰기·대소문자는 무시("현대기계" = "현대 기계").
// 숫자만 적으면 금액(합계)이 같은 거래도 찾음(쉼표 있어도 됨 — "150,000"). 한 결제로 묶인 거래는 한 줄만 맞아도 묶음 전체를 보여 줌
// (매입장에서 묶음이 한 줄로 보이므로 — 합계가 쪼개지지 않게). 주소 ?q= 로 남겨 상단 합계·목록·엑셀·인쇄가 같은 거래를 씀.
// 검사: ledgerSearch.test.ts

type NameRel = { name: string } | { name: string }[] | null | undefined;

export type LedgerSearchRow = {
  id: string;
  payment_group_id?: string | null;
  client_name_raw?: string | null;
  item_name?: string | null;
  note1?: string | null;
  note2?: string | null;
  sales_amount?: number | null;
  sales_vat?: number | null;
  purchase_amount?: number | null;
  purchase_vat?: number | null;
  clients?: NameRel;
  projects?: NameRel;
  expense_categories?: NameRel;
};

const nameOf = (rel: NameRel) => (Array.isArray(rel) ? rel[0]?.name : rel?.name) ?? "";
const squash = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, "");

/** 검색어 → 낱말 목록(빈 칸·공백만이면 빈 목록). 너무 긴 검색어는 앞 100글자만. */
export function searchTerms(query: string | null | undefined): string[] {
  return (query ?? "")
    .slice(0, 100)
    .split(/\s+/)
    .map(squash)
    .filter(Boolean);
}

/** 한 거래가 낱말을 모두 담고 있는지 */
export function matchesLedgerSearch(row: LedgerSearchRow, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const text = squash(
    [nameOf(row.clients), row.client_name_raw, row.item_name, row.note1, row.note2, nameOf(row.projects), nameOf(row.expense_categories)]
      .filter(Boolean)
      .join(" ")
  );
  const total =
    (row.sales_amount ?? 0) + (row.sales_vat ?? 0) + (row.purchase_amount ?? 0) + (row.purchase_vat ?? 0);
  return terms.every((term) => {
    if (text.includes(term)) return true;
    const digits = term.replace(/,/g, "");
    return /^\d+$/.test(digits) && Number(digits) === total;
  });
}

/** 검색어로 거른 거래 — 한 결제 묶음은 한 줄만 맞아도 묶음 전체. 검색어가 없으면 그대로. */
export function applyLedgerSearch<T extends LedgerSearchRow>(rows: T[], query: string | null | undefined): T[] {
  const terms = searchTerms(query);
  if (terms.length === 0) return rows;
  const hit = new Set<string>();
  const hitGroups = new Set<string>();
  for (const r of rows) {
    if (!matchesLedgerSearch(r, terms)) continue;
    hit.add(r.id);
    if (r.payment_group_id) hitGroups.add(r.payment_group_id);
  }
  return rows.filter((r) => hit.has(r.id) || (r.payment_group_id ? hitGroups.has(r.payment_group_id) : false));
}
