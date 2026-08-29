import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { DailyWorkerUsageTable } from "@/components/DailyWorkerUsageTable";

export async function DailyWorkerUsageSection() {
  const supabase = await createClient();
  const [{ data: offices }, { data: rows }] = await Promise.all([
    supabase.from("daily_worker_offices").select("name"),
    supabase
      .from("transactions")
      .select("id, trans_date, item_name, note1, note2, purchase_amount, purchase_vat, clients(name), client_name_raw")
      .eq("type", "매입")
      .order("trans_date", { ascending: false }),
  ]);

  const officeNames = new Set((offices ?? []).map((o) => o.name));

  const usageRows = (rows ?? [])
    .map((t) => ({
      id: t.id,
      trans_date: t.trans_date,
      client_name: (one(t.clients) as { name: string } | undefined)?.name ?? t.client_name_raw ?? "-",
      amount: t.purchase_amount + t.purchase_vat,
      note: t.note1 ?? t.note2 ?? "",
      item_name: t.item_name ?? "",
    }))
    .filter((t) => officeNames.has(t.client_name) || t.item_name.includes("인건비"));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">일용직 사용내역</h2>
        <p className="text-xs text-slate-400">
          매입 내역 중 거래처가 인력사무소이거나 품목에 &ldquo;인건비&rdquo;가 포함된 건을 자동으로 모았습니다.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <DailyWorkerUsageTable rows={usageRows} />
      </div>
    </div>
  );
}
