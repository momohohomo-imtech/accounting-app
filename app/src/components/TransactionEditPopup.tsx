import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { TransactionForm } from "@/components/TransactionForm";
import { updateTransactionRecord } from "@/lib/actions/transactions";

// 거래 수정 팝업 — 매입매출 목록, 외상 관리, 보고서(매입처별 집계) 어디서 열든 공통으로 씀.
export async function TransactionEditPopup({ editTx, redirectTo }: { editTx?: string; redirectTo: string }) {
  if (!editTx) return null;

  const supabase = await createClient();
  const [{ data: clients }, { data: sites }, { data: projects }, { data: paymentMethods }, { data: expenseCategories }, { data: tx }, { data: rawClientRows }] =
    await Promise.all([
      supabase.from("clients").select("id, name, default_item_name").order("name"),
      supabase.from("sites").select("id, name, clients(name)").order("name"),
      supabase.from("projects").select("id, name, site_id, status, year, project_code").order("name"),
      supabase.from("payment_methods").select("*").order("sort_order"),
      supabase.from("expense_categories").select("*").order("sort_order"),
      supabase.from("transactions").select("*").eq("id", editTx).single(),
      supabase.from("transactions").select("client_name_raw").not("client_name_raw", "is", null),
    ]);

  if (!tx) return null;

  const siteOptions = (sites ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    client_name: (one(s.clients) as { name: string } | undefined)?.name ?? null,
  }));
  const rawClientNames = Array.from(
    new Set((rawClientRows ?? []).map((r) => r.client_name_raw).filter((n): n is string => Boolean(n)))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10 print:static print:bg-transparent print:p-0">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl print:max-w-none print:rounded-none print:shadow-none">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">거래 수정</h2>
        <TransactionForm
          clients={clients ?? []}
          rawClientNames={rawClientNames}
          sites={siteOptions}
          projects={projects ?? []}
          paymentMethods={paymentMethods ?? []}
          expenseCategories={expenseCategories ?? []}
          initial={tx}
          action={updateTransactionRecord}
          redirectTo={redirectTo}
        />
      </div>
    </div>
  );
}
