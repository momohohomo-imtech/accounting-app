// 서버는 보통 UTC로 돌아서 new Date().getMonth() 등을 그대로 쓰면 한국 시간 자정~오전 9시엔
// 전날(월초엔 전달, 1월 1일엔 전년도)이 나온다. 서버 시간대와 무관하게 한국 시간 기준 오늘을 구함.
export function nowKst() {
  const d = new Date(Date.now() + 9 * 3600_000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

// 저장된 시각(UTC, ISO 문자열) → 한국 시각 "YYYY-MM-DD HH:MM" — 등록 시각·수정 이력 표시용.
export function kstDateTime(iso: string) {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString();
  return `${d.slice(0, 10)} ${d.slice(11, 16)}`;
}
