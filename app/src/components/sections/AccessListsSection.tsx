import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { createAccessListRecord, deleteAccessListRecord } from "@/lib/actions/access-lists";
import { formatDate } from "@/lib/format";
import { AccessListWorkerPicker } from "@/components/AccessListWorkerPicker";
import { AccessListExportButton } from "@/components/AccessListExportButton";

export async function AccessListsSection() {
  const supabase = await createClient();
  const [{ data: sites }, { data: offices }, { data: workers }, { data: employees }, { data: lists }, { data: links }] =
    await Promise.all([
      supabase.from("sites").select("id, name").order("name"),
      supabase.from("daily_worker_offices").select("id, name").order("name"),
      supabase.from("daily_workers").select("id, name, office_id, status").eq("status", "active").order("name"),
      supabase.from("employees").select("id, name").order("name"),
      supabase.from("access_lists").select("*, sites(name)").order("created_at", { ascending: false }),
      supabase
        .from("access_list_workers")
        .select(
          "access_list_id, daily_worker_id, employee_id, daily_workers(name, phone, nationality, birth_date), employees(name, phone, nationality, birth_date)"
        ),
    ]);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">출입명단</h2>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 font-semibold text-slate-900">출입명단 생성</h3>
        <form action={createAccessListRecord} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">원청 회사명</label>
              <input name="company_name" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">현장</label>
              <select name="site_id" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">선택 안함</option>
                {(sites ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">감독관</label>
              <input name="supervisor_name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">출입 기간</label>
              <input
                name="access_period"
                placeholder="예: 2026-08-23~24"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <AccessListWorkerPicker
            offices={offices ?? []}
            workers={(workers ?? []).map((w) => ({ id: w.id, name: w.name, office_id: w.office_id }))}
            employees={employees ?? []}
          />

          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            출입명단 생성
          </button>
        </form>
      </div>

      <div className="space-y-4">
        {(lists ?? []).map((l) => {
          const members = (links ?? [])
            .filter((lk) => lk.access_list_id === l.id)
            .map((lk) => {
              const source = lk.daily_worker_id ? one(lk.daily_workers) : one(lk.employees);
              return source
                ? {
                    name: source.name as string,
                    phone: (source.phone as string | null) ?? null,
                    nationality: (source.nationality as string | null) ?? null,
                    birthDate: (source.birth_date as string | null) ?? null,
                  }
                : null;
            })
            .filter((m): m is NonNullable<typeof m> => m !== null);

          return (
            <div key={l.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{l.company_name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {l.sites?.name ?? "현장 미지정"} · {l.supervisor_name ?? "감독관 미지정"} ·{" "}
                    {l.access_period ?? "기간 미지정"} · 생성일 {formatDate(l.created_at)}
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    인원 {members.length}명: {members.map((m) => m.name).join(", ") || "-"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <AccessListExportButton
                    companyName={l.company_name}
                    accessPeriod={l.access_period ?? ""}
                    supervisorName={l.supervisor_name ?? ""}
                    members={members}
                  />
                  <form action={deleteAccessListRecord}>
                    <input type="hidden" name="id" value={l.id} />
                    <button className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50">
                      삭제
                    </button>
                  </form>
                </div>
              </div>
            </div>
          );
        })}
        {(lists ?? []).length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">생성된 출입명단이 없습니다.</p>
        )}
      </div>
    </div>
  );
}
