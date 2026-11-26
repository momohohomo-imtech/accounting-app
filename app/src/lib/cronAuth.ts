import { timingSafeEqual } from "node:crypto";

// 크론 주소(/api/cron/*) 확인 — Vercel Cron은 환경변수 CRON_SECRET이 있으면 "Authorization: Bearer <CRON_SECRET>"를 붙여서 부름.
// 설정이 없거나 다르면 거부(fail closed). 글자를 한 글자씩 비교하면 맞힌 앞부분 길이만큼 응답 시간이 달라질 수 있어서,
// 같은 길이일 때 걸리는 시간이 같은 비교(timingSafeEqual)로(11/26 보안 점검). 검사: cronAuth.test.ts
export function isCronAuthorized(authorization: string | null | undefined, secret: string | null | undefined): boolean {
  if (!secret || !authorization) return false;
  const given = Buffer.from(authorization, "utf8");
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
