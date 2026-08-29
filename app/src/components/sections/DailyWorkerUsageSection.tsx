import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { formatWon, formatDate } from "@/lib/format";
import { Table, THead, Tr, Td, EmptyRow } from "@/components/ui/Table";

export async function DailyWorkerUsageSection() {
  const supabase = await createClient();
  const [{ data: offices }, { data: rows }] = await Promise.all([
    supabase.from("daily_worker_offices").select("name"),
    supabase
      .from("transactions")
      .select("trans_date, item_name, note1, note2, purchase_amount, purchase_vat, clients(name), client_name_raw")
      .eq("type", "매입")
      .order("trans_date", { ascending: false }),
  ]);

  const officeNames = new Set((offices ?? []).map((o) => o.name));

  const usageRows = (rows ?? [])
    .map((t) => ({
      trans_date: t.trans_date,
      client_name: (one(t.clients) as { name: string } | undefined)?.name ?? t.client_name_raw ?? "-",
      amount: t.purchase_amount + t.purchase_vat,
      note: t.note1 ?? t.note2 ?? "",
      item_name: t.item_name ?? "",
    }))
    .filter(
      (t) =>
        officeNames.has(t.client_name) ||
        t.item_name.includes("인건비")
    );

  const total = usageRows.reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">일용직 사용내역</h2>
        <p className="text-xs text-slate-400">
          매입 내역 중 거래처가 인력사무소이거나 품목에 &ldquo;인건비&rdquo;가 포함된 건을 자동으로 모았습니다.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <Table className="min-w-[600px]">
          <THead>
            <th className="pb-2 pr-4">날짜</th>
            <th className="pb-2 pr-4">거래처</th>
            <th className="pb-2 pr-4 text-right">금액</th>
            <th className="pb-2">비고</th>
          </THead>
          <tbody>
            {usageRows.map((t, i) => (
              <Tr key={i}>
                <Td className="pr-4">{formatDate(t.trans_date)}</Td>
                <Td className="pr-4">{t.client_name}</Td>
                <Td className="pr-4 text-right font-medium text-slate-900">{formatWon(t.amount)}</Td>
                <Td>{t.note || "-"}</Td>
              </Tr>
            ))}
            {usageRows.length === 0 && <EmptyRow colSpan={4}>일용직 사용 내역이 없습니다.</EmptyRow>}
          </tbody>
        </Table>
        {usageRows.length > 0 && (
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm text-slate-600">
            <span className="font-medium text-slate-500">총 {usageRows.length}건</span>
            <span>
              합계 <span className="font-mono font-semibold text-slate-900">{formatWon(total)}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
