import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { TransactionForm } from "@/components/TransactionForm";
import { createTransactionRecord } from "@/lib/actions/transactions";

export default async function NewTransactionPage() {
  const supabase = await createClient();
  const [{ data: clients }, { data: sites }, { data: projects }, { data: paymentMethods }, { data: expenseCategories }] =
    await Promise.all([
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("sites").select("id, name, clients(name)").order("name"),
      supabase.from("projects").select("id, name, site_id, status, year, project_code").order("name"),
      supabase.from("payment_methods").select("*").order("sort_order"),
      supabase.from("expense_categories").select("*").order("sort_order"),
    ]);

  const siteOptions = (sites ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    client_name: (one(s.clients) as { name: string } | undefined)?.name ?? null,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">매입매출 등록</h1>
      <TransactionForm
        clients={clients ?? []}
        sites={siteOptions}
        projects={projects ?? []}
        paymentMethods={paymentMethods ?? []}
        expenseCategories={expenseCategories ?? []}
        action={createTransactionRecord}
      />
    </div>
  );
}
