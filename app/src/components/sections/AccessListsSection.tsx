import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { createAccessListRecord, updateAccessListRecord, deleteAccessListRecord } from "@/lib/actions/access-lists";
import { sortByEmployeeNo } from "@/lib/format";
import { AccessListWorkerPicker } from "@/components/AccessListWorkerPicker";
import { AccessListSubmitButton } from "@/components/AccessListSubmitButton";
import { AccessListCard } from "@/components/AccessListCard";

export async function AccessListsSection() {
  const supabase = await createClient();
  const [{ data: sites }, { data: offices }, { data: workers }, { data: employeesRaw }, { data: lists }, { data: links }] =
    await Promise.all([
      supabase.from("sites").select("id, name").order("name"),
      supabase.from("daily_worker_offices").select("id, name").order("name"),
      supabase.from("daily_workers").select("id, name, office_id, status, grade").eq("status", "active").order("name"),
      supabase.from("employees").select("id, name, employee_no"),
      supabase.from("access_lists").select("*, sites(name)").order("created_at", { ascending: false }),
      supabase
        .from("access_list_workers")
        .select(
          "id, access_list_id, daily_worker_id, employee_id, note, manual_name, manual_phone, manual_birth_date, manual_nationality, daily_workers(name, phone, nationality, birth_date, grade), employees(name, phone, nationality, birth_date)"
        ),
    ]);

  const employees = sortByEmployeeNo(employeesRaw ?? []);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">출입명단</h2>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 font-semibold text-slate-900">출입명단 생성</h3>
        <form action={createAccessListRecord} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">원청 회사명</label>
              <input
                name="company_name"
                required
                autoComplete="off"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
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
              <input
                name="supervisor_name"
                autoComplete="off"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">출입 기간</label>
              <input
                name="access_period"
                placeholder="예: 2026-08-23~24"
                autoComplete="off"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <AccessListWorkerPicker
            offices={offices ?? []}
            workers={(workers ?? []).map((w) => ({ id: w.id, name: w.name, office_id: w.office_id, grade: w.grade }))}
            employees={employees}
          />

          <AccessListSubmitButton />
        </form>
      </div>

      <div className="space-y-4">
        {(lists ?? []).map((l) => {
          const members = (links ?? [])
            .filter((lk) => lk.access_list_id === l.id)
            .map((lk) => {
              const isEmployee = Boolean(lk.employee_id);
              if (lk.manual_name) {
                return {
                  id: lk.id as string,
                  isEmployee: false,
                  dailyWorkerId: null as string | null,
                  employeeId: null as string | null,
                  name: lk.manual_name as string,
                  phone: (lk.manual_phone as string | null) ?? null,
                  nationality: (lk.manual_nationality as string | null) ?? null,
                  birthDate: (lk.manual_birth_date as string | null) ?? null,
                  grade: null as string | null,
                  note: (lk.note as string | null) ?? "",
                };
              }
              const source = lk.daily_worker_id ? one(lk.daily_workers) : one(lk.employees);
              return source
                ? {
                    id: lk.id as string,
                    isEmployee,
                    dailyWorkerId: (lk.daily_worker_id as string | null) ?? null,
                    employeeId: (lk.employee_id as string | null) ?? null,
                    name: source.name as string,
                    phone: (source.phone as string | null) ?? null,
                    nationality: (source.nationality as string | null) ?? null,
                    birthDate: (source.birth_date as string | null) ?? null,
                    grade: (source as { grade?: string | null }).grade ?? null,
                    note: (lk.note as string | null) ?? "",
                  }
                : null;
            })
            .filter((m): m is NonNullable<typeof m> => m !== null)
            // 직원을 항상 위쪽에, 그다음 일용직 인력 순으로.
            .sort((a, b) => Number(b.isEmployee) - Number(a.isEmployee));

          return (
            <AccessListCard
              key={l.id}
              id={l.id}
              companyName={l.company_name}
              siteId={l.site_id}
              siteName={l.sites?.name ?? null}
              supervisorName={l.supervisor_name}
              accessPeriod={l.access_period}
              createdAt={l.created_at}
              members={members}
              siteOptions={sites ?? []}
              offices={offices ?? []}
              workers={(workers ?? []).map((w) => ({ id: w.id, name: w.name, office_id: w.office_id, grade: w.grade }))}
              employees={employees}
              updateAction={updateAccessListRecord}
              deleteAction={deleteAccessListRecord}
            />
          );
        })}
        {(lists ?? []).length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">생성된 출입명단이 없습니다.</p>
        )}
      </div>
    </div>
  );
}
