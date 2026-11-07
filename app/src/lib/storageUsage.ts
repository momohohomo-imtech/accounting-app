// 파일 저장 공간 사용량(사용자 요청 11/7 "추가 3") — 백업 화면 한 칸. 앱이 저장소에 올리는 파일은 첨부파일(project-files —
// attachments.file_size, 바이트)과 백업 파일(backups.file_size_mb)뿐이라 두 표의 크기를 더함(저장소 목록을 다 훑지 않음, DB 변경 없음).
// 크기를 모르는 첨부(아주 예전 기록)는 개수만 따로 알려 줌. 한도는 Supabase 무료 요금제 파일 저장 공간 1GB 기준.
// 검사: storageUsage.test.ts

export const FREE_STORAGE_LIMIT_MB = 1024;
/** 이 비율을 넘으면 경고 색 */
export const STORAGE_WARN_RATIO = 0.8;

export type StorageUsage = {
  attachmentsMb: number;
  attachmentCount: number;
  unknownSizeCount: number;
  backupsMb: number;
  backupCount: number;
  totalMb: number;
  /** 한도 대비 % (소수 첫째 자리) */
  pct: number;
  warn: boolean;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function storageUsage(
  attachmentSizesBytes: (number | null | undefined)[],
  backupSizesMb: (number | null | undefined)[],
  limitMb = FREE_STORAGE_LIMIT_MB
): StorageUsage {
  const known = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
  const attachmentBytes = attachmentSizesBytes.filter(known).reduce((s, v) => s + v, 0);
  const attachmentsMb = attachmentBytes / (1024 * 1024);
  const backupsMb = backupSizesMb.filter(known).reduce((s, v) => s + v, 0);
  const totalMb = attachmentsMb + backupsMb;
  return {
    attachmentsMb: round1(attachmentsMb),
    attachmentCount: attachmentSizesBytes.length,
    unknownSizeCount: attachmentSizesBytes.filter((v) => !known(v)).length,
    backupsMb: round1(backupsMb),
    backupCount: backupSizesMb.length,
    totalMb: round1(totalMb),
    pct: limitMb > 0 ? round1((totalMb / limitMb) * 100) : 0,
    warn: limitMb > 0 && totalMb >= limitMb * STORAGE_WARN_RATIO,
  };
}

/** "12.3MB", 1,024MB 이상은 "1.2GB" */
export function formatMb(mb: number): string {
  if (mb >= 1024) return `${(Math.round((mb / 1024) * 10) / 10).toLocaleString("ko-KR")}GB`;
  return `${round1(mb).toLocaleString("ko-KR")}MB`;
}
