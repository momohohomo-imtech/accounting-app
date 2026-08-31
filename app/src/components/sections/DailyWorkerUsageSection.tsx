import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { parseMonthRange } from "@/lib/monthRange";
import { DailyWorkerUsageFilter } from "@/components/DailyWorkerUsageFilter";
import { DailyWorkerUsageExportButtons } from "@/components/DailyWorkerUsageExportButtons";
import { DailyWorkerUsageTable } from "@/components/DailyWorkerUsageTable";

export async function DailyWorkerUsageSection({
  year,
  months,
  client,
}: {
  year?: string;
  months?: string;
  client?: string;
}) {
  const supabase = await createClient();
  const currentYear = new Date().getFullYear();
  const selectedYear = year ? Number(year) : currentYear;
  const { start, end, label: monthLabel } = parseMonthRange(months);

  const pad = (n: number) => String(n).padStart(2, "0");
  const rangeStart = `${selectedYear}-${pad(start)}-01`;
  const rangeEndDay = new Date(selectedYear, end, 0).getDate();
  const rangeEnd = `${selectedYear}-${pad(end)}-${pad(rangeEndDay)}`;

  const [{ data: offices }, { data: rows }, { data: firstTx }] = await Promise.all([
    supabase.from("daily_worker_offices").select("name"),
    supabase
      .from("transactions")
      .select("id, trans_date, item_name, note1, note2, purchase_amount, purchase_vat, clients(name), client_name_raw, projects(name)")
      .eq("type", "매입")
      .gte("trans_date", rangeStart)
      .lte("trans_date", rangeEnd)
      .order("trans_date", { ascending: false }),
    supabase.from("transactions").select("trans_date").order("trans_date", { ascending: true }).limit(1),
  ]);

  const officeNames = new Set((offices ?? []).map((o) => o.name));

  const usageRows = (rows ?? [])
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

  const clientOptions = Array.from(new Set(usageRows.map((r) => r.client_name))).sort((a, b) => a.localeCompare(b));
  const filteredRows = client ? usageRows.filter((r) => r.client_name === client) : usageRows;

  const firstYear = Math.min(
    firstTx?.[0]?.trans_date ? Number(firstTx[0].trans_date.slice(0, 4)) : currentYear,
    currentYear
  );
  const years = Array.from({ length: currentYear - firstYear + 1 }, (_, i) => currentYear - i);
  if (!years.includes(selectedYear)) years.unshift(selectedYear);
  years.sort((a, b) => b - a);

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <h2 className="text-lg font-semibold text-slate-900">일용직 사용내역</h2>
        <p className="text-xs text-slate-400">
          매입 내역 중 거래처가 인력사무소이거나 품목에 &ldquo;인건비&rdquo;가 포함된 건을 자동으로 모았습니다.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <DailyWorkerUsageFilter
          years={years}
          selectedYear={selectedYear}
          months={months ?? "1-12"}
          clientOptions={clientOptions}
          selectedClient={client ?? ""}
        />
        <DailyWorkerUsageExportButtons rows={filteredRows} periodLabel={`${selectedYear}년_${monthLabel}`} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <h2 className="mb-3 hidden font-semibold text-slate-900 print:block">
          일용직 사용내역 — {selectedYear}년 {monthLabel}
          {client ? ` · ${client}` : ""}
        </h2>
        <DailyWorkerUsageTable rows={filteredRows} />
      </div>
    </div>
  );
}
