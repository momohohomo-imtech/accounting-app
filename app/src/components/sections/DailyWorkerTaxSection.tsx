import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { DailyWorkerTaxFilter } from "@/components/DailyWorkerTaxFilter";
import { DailyWorkerUsageStatementTable } from "@/components/DailyWorkerUsageStatementTable";
import { PrintButton } from "@/components/PrintButton";

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

  const [{ data: offices }, { data: rows }, { data: firstTx }] = await Promise.all([
    supabase.from("daily_worker_offices").select("name"),
    supabase
      .from("transactions")
      .select("id, trans_date, item_name, note1, note2, purchase_amount, purchase_vat, clients(name), client_name_raw, projects(name)")
      .eq("type", "매입")
      .gte("trans_date", rangeStart)
      .lte("trans_date", rangeEnd)
      .order("trans_date", { ascending: true }),
    supabase.from("transactions").select("trans_date").order("trans_date", { ascending: true }).limit(1),
  ]);

  const officeNames = new Set((offices ?? []).map((o) => o.name));

  const statementRows = (rows ?? [])
    .map((t) => ({
      id: t.id,
      trans_date: t.trans_date,
      client_name: (one(t.clients) as { name: string } | undefined)?.name ?? t.client_name_raw ?? "-",
      amount: t.purchase_amount + t.purchase_vat,
      project_name: (one(t.projects) as { name: string } | undefined)?.name ?? "",
      note: t.note1 ?? t.note2 ?? "",
      item_name: t.item_name ?? "",
    }))
    .filter((t) => officeNames.has(t.client_name) || t.item_name.includes("인건비"));

  const firstYear = Math.min(
    firstTx?.[0]?.trans_date ? Number(firstTx[0].trans_date.slice(0, 4)) : currentYear,
    FLOOR_YEAR
  );
  const years = Array.from({ length: currentYear - firstYear + 1 }, (_, i) => currentYear - i);
  if (!years.includes(selectedYear)) years.unshift(selectedYear);
  years.sort((a, b) => b - a);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">세무사 확인용 — 일용직 사용내역서</h2>
          <p className="text-xs text-slate-400">
            선택한 달의 일용직 사용내역만 보여줍니다. 매입 내역 중 거래처가 인력사무소이거나 품목에 &ldquo;인건비&rdquo;가
            포함된 건을 자동으로 모았습니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DailyWorkerTaxFilter years={years} selectedYear={selectedYear} selectedMonth={selectedMonth} />
          <PrintButton />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <h2 className="mb-3 font-semibold text-slate-900">
          일용직 사용내역서 — {selectedYear}년 {selectedMonth}월
        </h2>
        <DailyWorkerUsageStatementTable rows={statementRows} />
      </div>
    </div>
  );
}
