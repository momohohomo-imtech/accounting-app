import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { formatWon } from "@/lib/format";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { DailyWorkerTaxFilter } from "@/components/DailyWorkerTaxFilter";
import { DailyWorkerUsageLogForm } from "@/components/DailyWorkerUsageLogForm";
import { DailyWorkerUsageStatementTable } from "@/components/DailyWorkerUsageStatementTable";
import { DailyWorkerUsageStatementExportButtons } from "@/components/DailyWorkerUsageStatementExportButtons";

const FLOOR_YEAR = 2026;

export async function DailyWorkerTaxSection({ year, month }: { year?: string; month?: string }) {
  const supabase = await createClient();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const selectedYear = year ? Number(year) : currentYear;
  const selectedMonth = month ? Number(month) : currentMonth;

  const pad = (n: number) => String(n).padStart(2, "0");
  const rangeStart = `${selectedYear}-${pad(selectedMonth)}-01`;
  const rangeEndDay = new Date(selectedYear, selectedMonth, 0).getDate();
  const rangeEnd = `${selectedYear}-${pad(selectedMonth)}-${pad(rangeEndDay)}`;

  const [{ data: offices }, { data: workers }, { data: sites }, { data: logs }, { data: firstLog }] = await Promise.all([
    supabase.from("daily_worker_offices").select("id, name").order("name"),
    supabase.from("daily_workers").select("id, name, office_id, status, grade").eq("status", "active").order("name"),
    supabase.from("sites").select("id, name").order("name"),
    supabase
      .from("daily_worker_usage_logs")
      .select(
        "id, use_date, daily_worker_id, note, daily_wage, site_id, daily_workers(name, resident_id, phone), sites(name)"
      )
      .gte("use_date", rangeStart)
      .lte("use_date", rangeEnd)
      .order("use_date", { ascending: false }),
    supabase.from("daily_worker_usage_logs").select("use_date").order("use_date", { ascending: true }).limit(1),
  ]);

  const statementRows = (logs ?? [])
    .map((l) => {
      const worker = one(l.daily_workers) as { name: string; resident_id: string | null; phone: string | null } | undefined;
      const site = one(l.sites) as { name: string } | undefined;
      return {
        id: l.id,
        use_date: l.use_date,
        daily_worker_id: l.daily_worker_id,
        name: worker?.name ?? "-",
        resident_id: worker?.resident_id ?? null,
        phone: worker?.phone ?? null,
        daily_wage: l.daily_wage,
        note: l.note,
        site_id: l.site_id,
        site_name: site?.name ?? null,
      };
    })
    .filter((r) => r.name !== "-");

  const totalPaid = statementRows.reduce((s, r) => s + (r.daily_wage ?? 0), 0);

  const firstYear = Math.min(
    firstLog?.[0]?.use_date ? Number(firstLog[0].use_date.slice(0, 4)) : currentYear,
    FLOOR_YEAR
  );
  const years = Array.from({ length: currentYear - firstYear + 1 }, (_, i) => currentYear - i);
  if (!years.includes(selectedYear)) years.unshift(selectedYear);
  years.sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h2 className="text-lg font-semibold text-slate-900">세무사 제출용 — 일용직 사용내역서</h2>
        <p className="text-xs text-slate-400">
          선택한 달에 사용한 일용직 근로자를 현장과 함께 등록해두면 사용일자·이름·주민번호·전화번호가 담긴 내역서로 보여줍니다. 소계는 현장 단위(연속일)로 묶입니다.
        </p>
      </div>

      <CollapsibleSection title="일용직 사용내역 등록" className="print:hidden">
        <DailyWorkerUsageLogForm
          offices={offices ?? []}
          workers={(workers ?? []).map((w) => ({ id: w.id, name: w.name, office_id: w.office_id, grade: w.grade }))}
          sites={sites ?? []}
        />
      </CollapsibleSection>

      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <DailyWorkerTaxFilter years={years} selectedYear={selectedYear} selectedMonth={selectedMonth} />
        <div className="flex flex-col items-end gap-1">
          <DailyWorkerUsageStatementExportButtons rows={statementRows} periodLabel={`${selectedYear}년_${selectedMonth}월`} />
          <p className="text-[11px] text-slate-400">PDF로 저장하려면 인쇄 대화상자의 대상(프린터)에서 &ldquo;PDF로 저장&rdquo;을 선택하세요.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-slate-900">
            일용직 사용내역서 — {selectedYear}년 {selectedMonth}월
          </h2>
          <p className="text-sm font-semibold text-slate-900">
            {selectedMonth}월 지급액 <span className="ml-1 font-mono">{formatWon(totalPaid)}</span>
          </p>
        </div>
        <DailyWorkerUsageStatementTable
          rows={statementRows}
          workers={(workers ?? []).map((w) => ({ id: w.id, name: w.name }))}
          sites={sites ?? []}
        />
      </div>
    </div>
  );
}
