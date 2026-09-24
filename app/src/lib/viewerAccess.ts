// 조회 전용(viewer) 계정이 들어갈 수 없는 경로 — 개인정보(직원·급여·일용직·출입명단)와
// 백업·계정 관리, 비용이 드는 AI/OCR 호출. DB에서도 읽기·쓰기가 막혀 있지만(084 SQL)
// 화면 자체를 열지 못하게 middleware와 메뉴에서 한 번 더 막는다.
export const VIEWER_BLOCKED_PAGE_PREFIXES = ["/employees", "/daily-workers", "/backups"];
export const VIEWER_BLOCKED_API_PREFIXES = ["/api/ocr", "/api/payroll-ocr", "/api/reports-ai"];

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isViewerBlockedPage(pathname: string) {
  return VIEWER_BLOCKED_PAGE_PREFIXES.some((p) => matches(pathname, p));
}

export function isViewerBlockedApi(pathname: string) {
  return VIEWER_BLOCKED_API_PREFIXES.some((p) => matches(pathname, p));
}
