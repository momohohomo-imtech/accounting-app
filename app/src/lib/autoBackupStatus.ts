// 자동 백업 실행 기록 — 크론(/api/cron/weekly-backup)이 실행할 때마다 backups 저장소의 _status/auto-backup.json 한 파일에 덮어씀
// (DB 변경 없음, 백업 목록·정리·복원은 backups 표 기록만 보므로 이 파일은 건드리지 않음). 11/3 사용자 "자동백업이 작동 안 하는 것
// 같아요" — 자동 백업이 실패하거나(오류·시간 초과) 막혀도(CRON_SECRET) 화면에 아무 표시가 없어 일주일 넘게 모르고 지나갔음.
// 백업 화면 "자동 백업 점검" 칸이 이 기록으로 마지막 실행 결과를 보여 줌. 검사: autoBackupStatus.test.ts.

export const AUTO_BACKUP_STATUS_PATH = "_status/auto-backup.json";
/** 시작 기록 뒤 이만큼 지나도 끝 기록이 없으면 "끝나지 않음" — 서버 시간 제한(60초)에 걸려 중간에 멈췄을 가능성 */
export const AUTO_BACKUP_RUNNING_GRACE_MINUTES = 5;

export type AutoBackupRun = {
  startedAt: string;
  finishedAt: string | null;
  /** true 성공, false 실패, null 아직 끝 기록 없음(실행 중 또는 중간에 멈춤) */
  ok: boolean | null;
  fileName?: string | null;
  sizeMb?: number | null;
  error?: string | null;
  /** 백업은 됐지만 완료 메일을 못 보냄 */
  emailError?: string | null;
  pruned?: number | null;
  /** 백업은 됐지만 오래된 자동 백업 정리 실패 */
  pruneError?: string | null;
};

const isIso = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));
const optText = (v: unknown) => (typeof v === "string" && v ? v : null);
const optNumber = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** 저장소에서 읽은 글자 → 기록(모양이 다르면 null) */
export function parseAutoBackupRun(text: string | null | undefined): AutoBackupRun | null {
  if (!text) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isIso(r.startedAt)) return null;
  return {
    startedAt: r.startedAt,
    finishedAt: isIso(r.finishedAt) ? r.finishedAt : null,
    ok: typeof r.ok === "boolean" ? r.ok : null,
    fileName: optText(r.fileName),
    sizeMb: optNumber(r.sizeMb),
    error: optText(r.error),
    emailError: optText(r.emailError),
    pruned: optNumber(r.pruned),
    pruneError: optText(r.pruneError),
  };
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");

/** 한국 시각 "2026-11-08(일) 06:00" */
export function formatKstDateTime(iso: string): string {
  const d = new Date(Date.parse(iso) + 9 * 3600_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}(${WEEKDAYS[d.getUTCDay()]}) ${pad(d.getUTCHours())}:${pad(
    d.getUTCMinutes()
  )}`;
}

export type AutoBackupRunView = {
  tone: "ok" | "warn" | "fail" | "none";
  title: string;
  detail: string | null;
};

export function describeAutoBackupRun(run: AutoBackupRun | null, nowIso: string): AutoBackupRunView {
  if (!run) {
    return { tone: "none", title: "아직 기록 없음", detail: "이 점검 칸이 배포된 뒤 첫 자동 실행부터 결과가 남습니다." };
  }
  const at = formatKstDateTime(run.startedAt);
  if (run.ok === true) {
    const notes = [
      run.fileName ? `파일 ${run.fileName}${run.sizeMb != null ? `(${run.sizeMb.toFixed(2)}MB)` : ""}` : null,
      run.pruned ? `오래된 자동 백업 ${run.pruned}개 정리` : null,
      run.pruneError ? `오래된 백업 정리 실패: ${run.pruneError}` : null,
      run.emailError ? `완료 메일 못 보냄: ${run.emailError}` : null,
    ].filter((v): v is string => Boolean(v));
    return { tone: run.pruneError || run.emailError ? "warn" : "ok", title: `${at} 성공`, detail: notes.join(" · ") || null };
  }
  if (run.ok === false) {
    return { tone: "fail", title: `${at} 실패`, detail: run.error ?? "이유를 남기지 못했습니다." };
  }
  const minutes = (Date.parse(nowIso) - Date.parse(run.startedAt)) / 60_000;
  if (minutes > AUTO_BACKUP_RUNNING_GRACE_MINUTES) {
    return {
      tone: "fail",
      title: `${at} 시작했지만 끝나지 않음`,
      detail: "서버 시간 제한(60초)에 걸려 중간에 멈췄을 수 있습니다 — \"지금 백업\"이 얼마나 걸리는지 확인해 주세요.",
    };
  }
  return { tone: "warn", title: `${at} 실행 중`, detail: null };
}

/** 다음 자동 백업 시각(ISO, UTC) — 매주 일요일 오전 6시(한국) = vercel.json "0 21 * * 6"(토요일 21:00 UTC). 지금 이후 첫 번째. */
export function nextAutoBackupAt(nowIso: string): string {
  const now = Date.parse(nowIso);
  const d = new Date(now);
  const daysToSat = (6 - d.getUTCDay() + 7) % 7;
  let next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + daysToSat, 21, 0, 0);
  if (next <= now) next += 7 * 86_400_000;
  return new Date(next).toISOString();
}
