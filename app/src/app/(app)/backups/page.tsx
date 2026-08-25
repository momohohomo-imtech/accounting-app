import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { BackupNowButton } from "@/components/BackupNowButton";
import { RestoreBackupButton } from "@/components/RestoreBackupButton";
import { deleteBackupRecord } from "@/lib/actions/backups";

export default async function BackupsPage() {
  const supabase = await createClient();
  const { data: backups } = await supabase.from("backups").select("*").order("created_at", { ascending: false });

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

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2 pr-4">파일명</th>
                <th className="pb-2 pr-4">유형</th>
                <th className="pb-2 pr-4">크기(MB)</th>
                <th className="pb-2 pr-4">생성일</th>
                <th className="pb-2 text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {withLinks.map((b) => (
                <tr key={b.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-4 text-slate-700">{b.file_name}</td>
                  <td className="py-2 pr-4 text-slate-700">{b.backup_type === "manual" ? "수동" : "자동"}</td>
                  <td className="py-2 pr-4 text-slate-700">{b.file_size_mb ?? "-"}</td>
                  <td className="py-2 pr-4 text-slate-600">{formatDate(b.created_at)}</td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-2">
                      {b.signedUrl && (
                        <a
                          href={b.signedUrl}
                          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
                        >
                          다운로드
                        </a>
                      )}
                      <RestoreBackupButton fileName={b.file_name} />
                      <form
                        action={async (fd) => {
                          await deleteBackupRecord(fd);
                        }}
                        onSubmit={(e) => {
                          if (!confirm(`이 백업(${b.file_name})을 삭제하시겠습니까?`)) e.preventDefault();
                        }}
                      >
                        <input type="hidden" name="id" value={b.id} />
                        <input type="hidden" name="fileName" value={b.file_name} />
                        <button className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50">
                          삭제
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {withLinks.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    백업 이력이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
