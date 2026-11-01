// 프로젝트 목록 상태 체크(검토중·진행중·…·기타) 기억하기(사용자 요청 11/1 "다음에 열 때 전부 불러오지 않게") — 체크를 바꾸면
// 이 기기(브라우저) 쿠키에 저장하고, 다음에 주소에 상태가 없이 열면 서버가 저장된 상태만 조회함. 주소에 상태가 있으면(다른 화면의
// 링크 등) 그게 먼저. 아무것도 체크 안 함(= 전체)도 "all"로 저장. 검사: projectStatusFilter.test.ts.
import { PROJECT_STATUS_OPTIONS } from "@/lib/projectStatus";

export const PROJECT_STATUS_FILTER_COOKIE = "projects_status_filter";
const ALL = "all";
const VALID = PROJECT_STATUS_OPTIONS.map((o) => o.value);

/** 쿠키에 넣을 값 — 쉼표는 쿠키 값에 쓰면 안 되는 글자라 "."로 이음. */
export function statusFilterCookieValue(statuses: string[]) {
  const list = VALID.filter((v) => statuses.includes(v));
  return list.length > 0 ? list.join(".") : ALL;
}

/** 저장된 쿠키 값 → 상태 목록(모르는 값은 버림). 없거나 "all"이면 빈 목록(= 전체). */
export function statusesFromCookie(value: string | undefined | null) {
  if (!value || value === ALL) return [];
  const saved = value.split(".");
  return VALID.filter((v) => saved.includes(v));
}

/** 주소의 status(쉼표로 구분)가 있으면 그것, 없으면 저장된 체크 — 주소에 넣을 모양("a,b")으로. */
export function effectiveStatusParam(param: string | undefined, cookieValue: string | undefined) {
  if (param !== undefined) return param;
  return statusesFromCookie(cookieValue).join(",");
}
