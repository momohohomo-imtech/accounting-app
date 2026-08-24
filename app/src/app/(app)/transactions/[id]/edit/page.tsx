import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TransactionForm } from "@/components/TransactionForm";
import { updateTransactionRecord } from "@/lib/actions/transactions";

export default async function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: clients }, { data: sites }, { data: projects }, { data: paymentMethods }, { data: expenseCategories }, { data: tx }] =
    await Promise.all([
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("sites").select("id, name, clients(name)").order("name"),
      supabase.from("projects").select("id, name, site_id, status, year, project_code").order("name"),
      supabase.from("payment_methods").select("*").order("sort_order"),
      supabase.from("expense_categories").select("*").order("sort_order"),
      supabase.from("transactions").select("*").eq("id", id).single(),
    ]);

  if (!tx) notFound();

  const siteOptions = (sites ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    client_name: (s.clients?.[0]?.name as string | undefined) ?? null,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">거래 수정</h1>
      <TransactionForm
        clients={clients ?? []}
        sites={siteOptions}
        projects={projects ?? []}
        paymentMethods={paymentMethods ?? []}
        expenseCategories={expenseCategories ?? []}
        initial={tx}
        action={updateTransactionRecord}
      />
    </div>
  );
}
