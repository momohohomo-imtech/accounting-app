// 매입매출장 거래 수정 팝업 주소 — 지금 보고 있는 목록(연·월·구분·프로젝트·글자 검색)을 그대로 두고 그 위에 수정 팝업만 엶.
// 매입매출장 표(TransactionTable)와 "챙길 거래" 창(TransactionWatchPanel)이 같이 씀. 검사: ledgerLinks.test.ts
export type LedgerListParams = { year: number; month: string; type: string; project_id: string; q?: string };

export function ledgerEditHref(listParams: LedgerListParams, id: string): string {
  const p = new URLSearchParams({
    year: String(listParams.year),
    month: listParams.month,
    type: listParams.type,
    project_id: listParams.project_id,
    editTx: id,
  });
  // 글자 검색 중이면 수정 팝업 뒤 목록도 검색된 그대로(닫으면 뒤로 가기라 검색이 남음)
  if (listParams.q) p.set("q", listParams.q);
  return `/transactions?${p.toString()}`;
}
