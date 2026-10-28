import { createClient } from "@/lib/supabase/server";
import { BackupNowButton } from "@/components/BackupNowButton";
import { BackupsTable } from "@/components/BackupsTable";
import { AccountPanel } from "@/components/AccountPanel";
import { getAccounts } from "@/lib/actions/accounts";
import { backupStatus, type BackupRecord } from "@/lib/backupStatus";

export default async function BackupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("users").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const isAdmin = profile?.role === "admin";

  const [{ data: backups }, accounts] = await Promise.all([
    supabase.from("backups").select("*").order("created_at", { ascending: false }),
    isAdmin ? getAccounts() : Promise.resolve([]),
  ]);

  // 자동 백업이 멈췄는지(대시보드 경고와 같은 기준) · 줄 수 칸(095 SQL)이 있는지.
  const status = backupStatus((backups ?? []) as BackupRecord[], new Date().toISOString());
  const hasRowCounts = (backups ?? []).some((b) => "row_counts" in b);

  const withLinks = await Promise.all(
    (backups ?? []).map(async (b) => {
      if (!b.storage_url) return { ...b, signedUrl: null };
      try {
        const { data } = await supabase.storage.from("backups").createSignedUrl(b.storage_url, 3600);
        return { ...b, signedUrl: data?.signedUrl ?? null };
      } catch {
        return { ...b, signedUrl: null };
      }
    })
  );

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
          Vercel의 크론 실행 기록과 CRON_SECRET 환경변수를 확인해주세요. 확인 전까지는 &quot;지금 백업&quot;으로 직접 백업해두세요.
        </p>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-xs text-slate-500">
          {hasRowCounts
            ? "백업은 표마다 모든 줄을 끝까지 담습니다(거래 = 백업에 담긴 거래 수). 거래 칸이 \"-\"인 예전 방식 백업은 표마다 1,000줄까지만 담겨, 1,000줄 이상인 표가 있으면 복원이 막힙니다."
            : "백업은 표마다 모든 줄을 끝까지 담습니다. 백업에 담긴 거래 수는 Supabase에서 095 SQL을 실행한 뒤 만든 백업부터 표시됩니다."}
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
