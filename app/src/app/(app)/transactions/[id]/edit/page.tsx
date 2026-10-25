import { notFound } from "next/navigation";
import { fetchAllRawClientNames } from "@/lib/supabaseFetchAll";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { TransactionForm } from "@/components/TransactionForm";
import { updateTransactionRecord } from "@/lib/actions/transactions";
import { loadPaymentGroupForEdit } from "@/lib/paymentGroup";

export default async function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: clients }, { data: sites }, { data: projects }, { data: paymentMethods }, { data: expenseCategories }, { data: tx }, { data: rawClientRows }] =
    await Promise.all([
      supabase.from("clients").select("id, name, default_item_name, default_category_id").order("name"),
      supabase.from("sites").select("id, name, clients(name)").order("name"),
      supabase.from("projects").select("id, name, site_id, status, year, project_code").order("name"),
      supabase.from("payment_methods").select("*").order("sort_order"),
      supabase.from("expense_categories").select("*").order("sort_order"),
      supabase.from("transactions").select("*").eq("id", id).single(),
      fetchAllRawClientNames(supabase),
    ]);

  if (!tx) notFound();
  // 한 결제로 묶인 거래면 묶음 줄을 같이 열어 한꺼번에 수정(092 SQL 실행 전엔 칸이 없어 묶기 기능을 숨김).
  const groupingReady = "payment_group_id" in tx;
  const { group, partOfGroup } = await loadPaymentGroupForEdit(supabase, tx);

  const siteOptions = (sites ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    client_name: (one(s.clients) as { name: string } | undefined)?.name ?? null,
  }));
  const rawClientNames = Array.from(
    new Set((rawClientRows ?? []).map((r) => r.client_name_raw).filter((n): n is string => Boolean(n)))
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">거래 수정</h1>
      <TransactionForm
        clients={clients ?? []}
        rawClientNames={rawClientNames}
        sites={siteOptions}
        projects={projects ?? []}
        paymentMethods={paymentMethods ?? []}
        expenseCategories={expenseCategories ?? []}
        initial={tx}
        initialGroup={group}
        partOfGroup={partOfGroup}
        groupingReady={groupingReady}
        action={updateTransactionRecord}
      />
    </div>
  );
}
