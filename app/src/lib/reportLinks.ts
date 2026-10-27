// 보고서 카테고리 상세(팝업) 주소 — 여러 개면 category를 반복(이름에 쉼표가 들어갈 수 있어 한 칸에 이어 붙이지 않음).
// 보고서 페이지(서버)와 카테고리 표·상세(화면)가 같이 씀 — 화면("use client") 파일에 두면 서버에서 못 불러서 lib에 둠.
export function categoryReportHref(year: number, names: string[]) {
  return `/reports?year=${year}&${names.map((n) => `category=${encodeURIComponent(n)}`).join("&")}`;
}
