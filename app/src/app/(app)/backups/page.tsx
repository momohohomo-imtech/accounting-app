import { createClient } from "@/lib/supabase/server";
import { BackupNowButton } from "@/components/BackupNowButton";
import { BackupsTable } from "@/components/BackupsTable";
import { AccountPanel } from "@/components/AccountPanel";
import { getAccounts } from "@/lib/actions/accounts";
import { backupStatus, type BackupRecord } from "@/lib/backupStatus";
import {
  AUTO_BACKUP_STATUS_PATH,
  describeAutoBackupRun,
  formatKstDateTime,
  nextAutoBackupAt,
  parseAutoBackupRun,
  type AutoBackupRunView,
} from "@/lib/autoBackupStatus";
import { cx } from "@/lib/cx";
import { checkSqlStatus } from "@/lib/sqlStatus";
import { SqlStatusTable } from "@/components/SqlStatusTable";
import { storageUsage, formatMb, FREE_STORAGE_LIMIT_MB } from "@/lib/storageUsage";
import { fetchAllRows } from "@/lib/supabaseFetchAll";

const TONE_CLASS: Record<AutoBackupRunView["tone"], string> = {
  ok: "text-emerald-700",
  warn: "text-amber-700",
  fail: "text-red-700",
  none: "text-slate-500",
};

// 자동 백업 점검 칸 한 줄 — 휴대폰은 이름 위·내용 아래
function CheckRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 py-2 sm:grid-cols-[11rem_minmax(0,1fr)]">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-800">{children}</dd>
    </div>
  );
}

// 이 화면의 서버 액션(지금 백업·복원)이 쓸 수 있는 시간 — 복원은 백업 파일을 나눠 올리고, 직전 상태를 한 번 더 백업한 뒤
// 한 번에 바꿔서 기본 제한(설정에 따라 10~15초)을 넘을 수 있음. 넘어도 DB는 한 번에 바뀌거나 그대로라 반만 바뀌지는 않음.
export const maxDuration = 60;

export default async function BackupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("users").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const isAdmin = profile?.role === "admin";
  // 자동 백업 점검(서버 설정·마지막 자동 실행 기록) — 백업 저장소를 읽을 수 있는 관리자·직원만
  const canCheckAuto = profile?.role === "admin" || profile?.role === "staff";

  const [{ data: backups }, accounts, lastRunText, sqlRows, attachmentSizes] = await Promise.all([
    supabase.from("backups").select("*").order("created_at", { ascending: false }),
    isAdmin ? getAccounts() : Promise.resolve([]),
    canCheckAuto
      ? supabase.storage
          .from("backups")
          .download(AUTO_BACKUP_STATUS_PATH)
          .then(({ data }) => (data ? data.text() : null))
          .catch(() => null)
      : Promise.resolve(null),
    // SQL 실행 상태(11/7) — 표·칸을 1줄씩 읽어 보기만(lib/sqlStatus.ts)
    canCheckAuto ? checkSqlStatus(supabase) : Promise.resolve([]),
    // 저장 공간(11/7) — 첨부파일 크기(바이트)만. 못 읽으면 칸을 숨김
    canCheckAuto
      ? fetchAllRows<{ id: string; file_size: number | null }>((from, to) =>
          supabase.from("attachments").select("id, file_size").order("id", { ascending: true }).range(from, to)
        ).catch(() => null)
      : Promise.resolve(null),
  ]);
  const neededSql = sqlRows.filter((r) => r.state === "needed").map((r) => r.file);
  const unknownSql = sqlRows.filter((r) => r.state === "unknown").map((r) => r.file);
  const usage = attachmentSizes
    ? storageUsage(
        attachmentSizes.map((a) => a.file_size),
        (backups ?? []).map((b) => b.file_size_mb as number | null)
      )
    : null;
  const nowIso = new Date().toISOString();
  const lastRun = describeAutoBackupRun(parseAutoBackupRun(lastRunText), nowIso);
  // 서버 환경변수가 있는지만(값은 보이지 않음) — CRON_SECRET이 없으면 자동 백업이 늘 막힘(11/3 자동 백업이 안 된 원인 후보)
  const config = {
    cronSecret: Boolean(process.env.CRON_SECRET),
    serviceKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    email: Boolean(process.env.BACKUP_EMAIL_TO) && Boolean(process.env.RESEND_API_KEY),
  };

  // 자동 백업이 멈췄는지(대시보드 경고와 같은 기준) · 줄 수 칸(095 SQL)이 있는지.
  const status = backupStatus((backups ?? []) as BackupRecord[], nowIso);
  const hasRowCounts = (backups ?? []).some((b) => "row_counts" in b);

  // 내려받기 주소를 한 번에(백업마다 따로 요청하지 않게).
  const paths = (backups ?? []).map((b) => b.storage_url).filter((p): p is string => Boolean(p));
  const signedByPath = new Map<string, string>();
  if (paths.length > 0) {
    try {
      const { data } = await supabase.storage.from("backups").createSignedUrls(paths, 3600);
      for (const d of data ?? []) if (d.path && d.signedUrl && !d.error) signedByPath.set(d.path, d.signedUrl);
    } catch {
      // 주소를 못 만들면 내려받기 칸만 비움
    }
  }
  const withLinks = (backups ?? []).map((b) => ({
    ...b,
    signedUrl: b.storage_url ? (signedByPath.get(b.storage_url) ?? null) : null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">백업</h1>
        <BackupNowButton />
      </div>

      {status.autoStale && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {status.daysSinceAuto == null
            ? "자동 백업 기록이 없습니다."
            : `마지막 자동 백업 후 ${status.daysSinceAuto}일이 지났습니다(매주 일요일 오전 6시 실행).`}{" "}
          {canCheckAuto ? "아래 \"자동 백업 점검\"을 확인해 주세요." : "관리자에게 알려 주세요."} 확인 전까지는 &quot;지금 백업&quot;으로 직접
          백업해두세요.
        </p>
      )}

      {canCheckAuto && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">자동 백업 점검</h2>
          <dl className="mt-2 divide-y divide-slate-100">
            <CheckRow label="마지막 자동 실행">
              <span className={cx("font-medium", TONE_CLASS[lastRun.tone])}>{lastRun.title}</span>
              {lastRun.detail && <span className="mt-0.5 block text-xs text-slate-500">{lastRun.detail}</span>}
            </CheckRow>
            <CheckRow label="마지막 자동 백업">
              {status.lastAutoAt ? (
                <span className={status.autoStale ? "font-medium text-red-700" : undefined}>
                  {formatKstDateTime(status.lastAutoAt)}
                  {status.daysSinceAuto != null && ` (${status.daysSinceAuto === 0 ? "오늘" : `${status.daysSinceAuto}일 전`})`}
                </span>
              ) : (
                <span className="font-medium text-red-700">없음</span>
              )}
            </CheckRow>
            <CheckRow label="다음 예정">
              {formatKstDateTime(nextAutoBackupAt(nowIso))}
              <span className="mt-0.5 block text-xs text-slate-500">
                매주 일요일 오전 6시. Vercel → 프로젝트 → Settings → Cron Jobs에서 &quot;Run&quot;을 누르면 지금 바로 실행해 볼 수 있고, 결과는 위
                &quot;마지막 자동 실행&quot;에 남습니다.
              </span>
            </CheckRow>
            <CheckRow label="자동 실행 비밀값">
              <span className="mr-2 text-xs text-slate-400">CRON_SECRET</span>
              {config.cronSecret ? (
                <span className="font-medium text-emerald-700">설정됨</span>
              ) : (
                <>
                  <span className="font-medium text-red-700">없음 — 자동 백업이 실행되지 않습니다</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Vercel → 프로젝트 → Settings → Environment Variables에서 이름 CRON_SECRET, 값은 16자 이상 아무 글자, 환경은 Production에
                    체크해 저장한 뒤 Deployments에서 맨 위 배포를 Redeploy 해 주세요.
                  </span>
                </>
              )}
            </CheckRow>
            <CheckRow label="서버 키">
              <span className="mr-2 break-all text-xs text-slate-400">SUPABASE_SERVICE_ROLE_KEY</span>
              {config.serviceKey ? (
                <span className="font-medium text-emerald-700">설정됨</span>
              ) : (
                <span className="font-medium text-red-700">없음 — 자동 백업이 실행되지 않습니다</span>
              )}
            </CheckRow>
            <CheckRow label="백업 메일">
              {config.email ? "보냄(완료·실패 모두)" : "안 보냄(선택 — BACKUP_EMAIL_TO·RESEND_API_KEY를 넣으면 완료·실패 메일)"}
            </CheckRow>
          </dl>
          <p className="mt-2 text-[11px] text-slate-400">설정값 자체는 보이지 않고, 지금 실행 중인 배포에 들어 있는지만 확인합니다.</p>
        </div>
      )}

      {canCheckAuto && usage && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">파일 저장 공간</h2>
          <dl className="mt-2 divide-y divide-slate-100">
            <CheckRow label="합계">
              <span className={cx("font-medium", usage.warn ? "text-red-700" : "text-slate-900")}>
                약 {formatMb(usage.totalMb)}
              </span>
              <span className="ml-2 text-xs text-slate-500">
                무료 요금제 한도 {formatMb(FREE_STORAGE_LIMIT_MB)}의 {usage.pct.toLocaleString("ko-KR")}%
              </span>
              <span className="mt-1 block h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-slate-100">
                <span
                  className={cx("block h-full rounded-full", usage.warn ? "bg-red-500" : "bg-slate-400")}
                  style={{ width: `${Math.min(100, usage.pct)}%` }}
                />
              </span>
              {usage.warn && (
                <span className="mt-1 block text-xs text-red-700">
                  80%를 넘었습니다 — 오래된 첨부·직접 만든 백업을 정리하거나 Supabase 요금제를 확인해 주세요.
                </span>
              )}
            </CheckRow>
            <CheckRow label="첨부파일">
              {usage.attachmentCount.toLocaleString("ko-KR")}개 · {formatMb(usage.attachmentsMb)}
              {usage.unknownSizeCount > 0 && (
                <span className="ml-1 text-xs text-slate-500">(크기 모름 {usage.unknownSizeCount.toLocaleString("ko-KR")}개 제외)</span>
              )}
            </CheckRow>
            <CheckRow label="백업 파일">
              {usage.backupCount.toLocaleString("ko-KR")}개 · {formatMb(usage.backupsMb)}
            </CheckRow>
          </dl>
          <p className="mt-2 text-[11px] text-slate-400">
            앱이 올린 파일(첨부·백업)의 크기를 더한 값입니다. 거래 등 DB 자료(무료 요금제 500MB)는 따로이며, 정확한 사용량은 Supabase →
            Project Settings → Usage에서 볼 수 있습니다.
          </p>
        </div>
      )}

      {canCheckAuto && sqlRows.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">SQL 실행 상태</h2>
          <p className={cx("mt-1 text-sm", neededSql.length > 0 ? "font-medium text-red-700" : "text-emerald-700")}>
            {neededSql.length > 0
              ? `실행이 필요한 SQL ${neededSql.length}개: ${neededSql.join(", ")} — 실행 전엔 그 기능이 숨겨져 있습니다.`
              : unknownSql.length > 0
                ? "확인한 SQL은 모두 실행됐습니다."
                : "아래 SQL은 모두 실행됐습니다."}
          </p>
          {unknownSql.length > 0 && (
            <p className="mt-0.5 text-xs text-amber-700">
              확인하지 못한 SQL {unknownSql.length}개: {unknownSql.join(", ")} — 연결이 잠깐 끊겼을 수 있으니 새로 고침해 보세요.
            </p>
          )}
          <p className="mb-3 mt-1 text-xs text-slate-500">
            실행 필요인 번호는 Supabase → SQL Editor에서 그 번호의 SQL 파일 내용을 붙여 넣고 Run(작은 번호부터 차례로). 확인은 표·칸이
            있는지만 읽어 봅니다. 084(조회 전용 계정)·091(견적·발주 번호 — 097에 다시 들어 있음)은 표·칸이 없어 여기서 확인할 수 없습니다.
          </p>
          <SqlStatusTable rows={sqlRows} />
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-xs text-slate-500">
          {hasRowCounts
            ? "백업은 표마다 모든 줄을 끝까지 담습니다(거래 = 백업에 담긴 거래 수). 거래 칸이 \"-\"인 예전 방식 백업은 표마다 1,000줄까지만 담겨, 1,000줄 이상인 표가 있으면 복원이 막힙니다."
            : "백업은 표마다 모든 줄을 끝까지 담습니다. 백업에 담긴 거래 수는 Supabase에서 095 SQL을 실행한 뒤 만든 백업부터 표시됩니다."}
        </p>
        <p className="mb-3 text-xs text-slate-500">
          자동 백업은 최근 8주 것은 모두, 그 전 1년은 달마다 첫 백업 1개만 남기고 오래된 것은 자동으로 정리합니다(직접 만든 백업과
          복원 직전 백업은 지우지 않음). 새 백업은 압축 파일(.json.gz)로 저장됩니다 — 복원은 그대로 되고, 내려받은 파일은 반디집·
          7-Zip 등으로 풀면 JSON입니다.
        </p>
        <div className="overflow-x-auto">
          <BackupsTable backups={withLinks} />
        </div>
      </div>

      {isAdmin && user && (
        <AccountPanel
          accounts={accounts}
          currentUserId={user.id}
          adminApiConfigured={Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)}
        />
      )}
    </div>
  );
}
