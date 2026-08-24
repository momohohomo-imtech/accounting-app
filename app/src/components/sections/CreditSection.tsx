import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/format";
import { remainingBalance, transactionTotal } from "@/lib/credit";
import type { CreditPayment, PaymentMethod, Transaction } from "@/lib/types";
import { CreditSettlementGroup } from "@/components/CreditSettlementGroup";
import { CreditHistoryToggle, type SettlementHistoryGroup } from "@/components/CreditHistoryToggle";
import { CreditExportButtons } from "@/components/CreditExportButtons";
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

  const settlementIds = Array.from(
    new Set((payments ?? []).map((p) => p.settlement_transaction_id).filter((id): id is string => Boolean(id)))
  );
  const { data: settlements } = settlementIds.length
    ? await supabase.from("transactions").select("*, clients(name), payment_methods(name)").in("id", settlementIds)
    : { data: [] as never[] };

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

  const originalById = new Map(txs.map((tx) => [tx.id, tx]));
  const historyMap = new Map<string, SettlementHistoryGroup>();
  for (const settlement of (settlements ?? []) as Transaction[]) {
    historyMap.set(settlement.id, {
      id: settlement.id,
      clientLabel: `${settlement.clients?.name ?? settlement.client_name_raw ?? "거래처 미지정"}`,
      trans_date: settlement.trans_date,
      methodName: settlement.payment_methods?.name ?? null,
      total: transactionTotal(settlement),
      items: [],
    });
  }
  for (const p of pays) {
    if (!p.settlement_transaction_id) continue;
    const group = historyMap.get(p.settlement_transaction_id);
    const original = originalById.get(p.transaction_id);
    if (!group || !original) continue;
    group.items.push({
      item_name: original.item_name,
      trans_date: original.trans_date,
      amount: transactionTotal(original),
      project_name: original.projects?.name ?? null,
    });
  }
  const historyGroups = Array.from(historyMap.values()).sort((a, b) => b.trans_date.localeCompare(a.trans_date));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">외상 관리</h2>
        <div className="flex items-center gap-3">
          <CreditExportButtons outstandingGroups={groupList} historyGroups={historyGroups} />
          <Card padding="none" className="px-5 py-3">
            <p className="text-xs text-slate-500">전체 외상 잔액</p>
            <p className="text-xl font-bold text-slate-900">{formatWon(totalOutstanding)}</p>
          </Card>
        </div>
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

      <div className="border-t border-slate-200 pt-4">
        <CreditHistoryToggle groups={historyGroups} />
      </div>
    </div>
  );
}
