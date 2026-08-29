import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/format";
import { remainingBalance, transactionTotal } from "@/lib/credit";
import type { CreditPayment, PaymentMethod, Transaction } from "@/lib/types";
import { CreditSettlementGroup } from "@/components/CreditSettlementGroup";
import { CreditHistoryToggle, type VendorHistoryGroup, type VendorHistoryItem } from "@/components/CreditHistoryToggle";
import { PrintButton } from "@/components/PrintButton";
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

  // remaining > 0이면 당연히 미정산. remaining이 0이어도 정산 이력이 아예 없으면
  // (금액을 0원으로 입력한 외상 건 등) 계속 목록에 보여줘야 수정/삭제할 수 있음 —
  // 실제로 정산돼서 0원이 된 건만(결제 이력 있음) 목록에서 빠져야 함.
  const outstanding = txs
    .map((tx) => ({ tx, remaining: remainingBalance(tx, pays) }))
    .filter((item) => item.remaining > 0 || !pays.some((p) => p.transaction_id === item.tx.id));

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

  // 외상 거래를 한 번이라도 한 거래처는 전체 거래(즉시결제 포함) 이력을 보여준다.
  // client_id가 없는(거래처 미등록) 옛 데이터도 client_name_raw로 잡아준다.
  const vendorClientIds = Array.from(
    new Set(txs.map((t) => t.client_id).filter((id): id is string => Boolean(id)))
  );
  const vendorRawNames = Array.from(
    new Set(txs.filter((t) => !t.client_id).map((t) => t.client_name_raw).filter((n): n is string => Boolean(n)))
  );

  const [{ data: vendorAllTxById }, { data: vendorAllTxByName }] = await Promise.all([
    vendorClientIds.length
      ? supabase
          .from("transactions")
          .select("*, clients(name), projects(name), payment_methods(name)")
          .in("client_id", vendorClientIds)
          .order("trans_date", { ascending: false })
      : Promise.resolve({ data: [] as Transaction[] }),
    vendorRawNames.length
      ? supabase
          .from("transactions")
          .select("*, clients(name), projects(name), payment_methods(name)")
          .is("client_id", null)
          .in("client_name_raw", vendorRawNames)
          .order("trans_date", { ascending: false })
      : Promise.resolve({ data: [] as Transaction[] }),
  ]);
  const vendorAllTx = [...(vendorAllTxById ?? []), ...(vendorAllTxByName ?? [])];

  const vendorGroupMap = new Map<string, VendorHistoryGroup>();
  for (const tx of vendorAllTx as Transaction[]) {
    const key = tx.client_id ?? `raw:${tx.client_name_raw}`;
    if (!vendorGroupMap.has(key)) {
      vendorGroupMap.set(key, { key, label: tx.clients?.name ?? tx.client_name_raw ?? "거래처", items: [] });
    }
    let status: VendorHistoryItem["status"];
    if (tx.payment_type === "credit") {
      status = remainingBalance(tx, pays) > 0 ? "미정산" : "정산완료";
    } else if (tx.item_name?.startsWith("외상 정산")) {
      status = "정산 합계";
    } else {
      status = "즉시결제";
    }
    vendorGroupMap.get(key)!.items.push({
      id: tx.id,
      trans_date: tx.trans_date,
      item_name: tx.item_name,
      project_name: tx.projects?.name ?? null,
      needs_classification: tx.needs_classification,
      amount: transactionTotal(tx),
      status,
      methodName: tx.payment_methods?.name ?? null,
    });
  }
  const vendorHistoryGroups = Array.from(vendorGroupMap.values()).sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">외상 관리</h2>
        <div className="flex items-center gap-3">
          <PrintButton />
          <Card padding="none" className="px-5 py-3">
            <p className="text-xs text-slate-500">전체 외상 잔액</p>
            <p className="text-xl font-bold text-slate-900">{formatWon(totalOutstanding)}</p>
          </Card>
        </div>
      </div>

      <div className="space-y-4">
        {groupList.map((g) => (
          <CreditSettlementGroup key={g.key} label={g.label} items={g.items} paymentMethods={methods} />
        ))}
        {groupList.length === 0 && <p className="py-8 text-center text-sm text-slate-400">미정산 외상 거래가 없습니다.</p>}
      </div>

      <div className="border-t border-slate-200 pt-4">
        <CreditHistoryToggle groups={vendorHistoryGroups} />
      </div>
    </div>
  );
}
