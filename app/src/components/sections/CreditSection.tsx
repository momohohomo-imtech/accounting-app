import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/format";
import { remainingBalance } from "@/lib/credit";
import type { CreditPayment, PaymentMethod, Transaction } from "@/lib/types";
import { CreditSettlementGroup } from "@/components/CreditSettlementGroup";
import { Card } from "@/components/ui/Card";

export async function CreditSection() {
  const supabase = await createClient();
  const [{ data: creditTx }, { data: payments }, { data: paymentMethods }] = await Promise.all([
    supabase
      .from("transactions")
      .select("*, clients(name), projects(name)")
      .eq("payment_type", "credit")
      .order("trans_date", { ascending: false }),
    supabase.from("credit_payments").select("*"),
    supabase.from("payment_methods").select("*").order("sort_order"),
  ]);

  const txs = (creditTx ?? []) as Transaction[];
  const pays = (payments ?? []) as CreditPayment[];
  const methods = (paymentMethods ?? []) as PaymentMethod[];

  const outstanding = txs
    .map((tx) => ({ tx, remaining: remainingBalance(tx, pays) }))
    .filter((item) => item.remaining > 0);

  const totalOutstanding = outstanding.reduce((s, item) => s + item.remaining, 0);

  type Group = {
    key: string;
    label: string;
    client_id: string | null;
    client_name_raw: string | null;
    items: typeof outstanding;
  };
  const groups = new Map<string, Group>();
  for (const item of outstanding) {
    const clientKey = item.tx.client_id ?? `raw:${item.tx.client_name_raw ?? "미지정"}`;
    const key = `${clientKey}::${item.tx.type}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: `${item.tx.clients?.name ?? item.tx.client_name_raw ?? "거래처 미지정"} · ${item.tx.type}`,
        client_id: item.tx.client_id,
        client_name_raw: item.tx.client_name_raw,
        items: [],
      });
    }
    groups.get(key)!.items.push(item);
  }
  const groupList = Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">외상 관리</h2>
        <Card padding="none" className="px-5 py-3">
          <p className="text-xs text-slate-500">전체 외상 잔액</p>
          <p className="text-xl font-bold text-slate-900">{formatWon(totalOutstanding)}</p>
        </Card>
      </div>

      <div className="space-y-4">
        {groupList.map((g) => (
          <CreditSettlementGroup
            key={g.key}
            label={g.label}
            clientId={g.client_id}
            clientNameRaw={g.client_name_raw}
            items={g.items}
            paymentMethods={methods}
          />
        ))}
        {groupList.length === 0 && <p className="py-8 text-center text-sm text-slate-400">미정산 외상 거래가 없습니다.</p>}
      </div>
    </div>
  );
}
