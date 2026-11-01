// 자동 백업 정리 기준(사용자 결정 10/31 "8주 + 월 1개 1년") — 검사: backupRetention.test.ts.
// - 최근 8주(56일) 자동 백업은 전부 남김
// - 그보다 오래되고 1년(365일) 안인 자동 백업은 달마다(한국 날짜) 가장 이른 것 1개만 남김
// - 1년이 넘은 자동 백업은 지움
// - 직접 만든 백업(지금 백업·복원 직전 백업 = manual)은 날짜와 상관없이 지우지 않음
// - 안전장치: 날짜와 상관없이 가장 최근 자동 백업 8개는 늘 남김(크론이 오래 멈췄다가 다시 돌아도 한꺼번에 지워지지 않게)
// 예전엔 매주 백업이 끝없이 쌓여서, 몇 년이면 저장 공간(무료 요금제 1GB)이 백업으로 찼음.
export const KEEP_ALL_DAYS = 56;
export const KEEP_MONTHLY_DAYS = 365;
export const KEEP_LATEST_AUTO = 8;

export type RetentionRecord = {
  id: string;
  backup_type: string;
  created_at: string;
  file_name: string;
  storage_url?: string | null;
};

const DAY_MS = 86_400_000;
const kstMonth = (iso: string) => new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(0, 7);

/** 지울 자동 백업 목록(가장 오래된 것부터). */
export function backupsToPrune(records: RetentionRecord[], nowIso: string): RetentionRecord[] {
  const now = Date.parse(nowIso);
  const autos = records
    .filter((r) => r.backup_type === "auto" && Number.isFinite(Date.parse(r.created_at)))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const keep = new Set<string>(autos.slice(0, KEEP_LATEST_AUTO).map((r) => r.id));
  const firstOfMonth = new Map<string, RetentionRecord>();
  for (const r of autos) {
    const ageDays = (now - Date.parse(r.created_at)) / DAY_MS;
    if (ageDays <= KEEP_ALL_DAYS) {
      keep.add(r.id);
    } else if (ageDays <= KEEP_MONTHLY_DAYS) {
      const month = kstMonth(r.created_at);
      const current = firstOfMonth.get(month);
      if (!current || Date.parse(r.created_at) < Date.parse(current.created_at)) firstOfMonth.set(month, r);
    }
  }
  for (const r of firstOfMonth.values()) keep.add(r.id);
  return autos.filter((r) => !keep.has(r.id)).reverse();
}
