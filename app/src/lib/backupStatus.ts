// 백업 상태 — 대시보드 "백업" 줄·경고와 백업 화면 안내가 같이 씀.
// 자동 백업은 매주 일요일 오전 6시(한국 시각, vercel.json 크론 "토 21:00 UTC"). 마지막 자동 백업 후 8일(한 주 + 하루 여유)이
// 넘으면 멈춘 것으로 봄 — 크론 설정(CRON_SECRET)이 빠지거나 백업이 실패해도 화면에 아무 표시가 없어 모르고 지나갈 수 있었음.
export const AUTO_BACKUP_STALE_DAYS = 8;

export type BackupRecord = {
  backup_type: string;
  created_at: string;
  // 표별 줄 수(095 SQL로 생기는 칸) — 끝까지 담은 새 방식 백업만 값이 있음. 칸이 없으면(SQL 실행 전) undefined, 예전 백업은 null.
  row_counts?: Record<string, number> | null;
};

export type BackupStatus = {
  latest: BackupRecord | null;
  lastAutoAt: string | null;
  // 마지막 자동 백업 후 지난 날 수(한국 날짜 기준) — 자동 백업이 한 번도 없으면 null.
  daysSinceAuto: number | null;
  autoStale: boolean;
  // 가장 최근 백업이 끝까지 담은 새 방식인지 — 줄 수 칸이 없으면(SQL 실행 전) 알 수 없어서 null.
  latestComplete: boolean | null;
  // 가장 최근 백업에 담긴 거래 수(새 방식만).
  latestTransactionCount: number | null;
};

const kstDay = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
const dayNumber = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / 86_400_000;

export function backupStatus(records: BackupRecord[], nowIso: string): BackupStatus {
  const newest = [...records].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const latest = newest[0] ?? null;
  const lastAuto = newest.find((r) => r.backup_type === "auto") ?? null;
  const daysSinceAuto = lastAuto ? dayNumber(kstDay(nowIso)) - dayNumber(kstDay(lastAuto.created_at)) : null;
  const counts = latest?.row_counts;
  return {
    latest,
    lastAutoAt: lastAuto?.created_at ?? null,
    daysSinceAuto,
    autoStale: daysSinceAuto == null || daysSinceAuto > AUTO_BACKUP_STALE_DAYS,
    latestComplete: !latest || counts === undefined ? null : counts !== null,
    latestTransactionCount: typeof counts?.transactions === "number" ? counts.transactions : null,
  };
}
