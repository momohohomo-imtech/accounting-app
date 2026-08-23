import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TransactionForm } from "@/components/TransactionForm";
import { updateTransactionRecord } from "@/lib/actions/transactions";

export default async function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: clients }, { data: projects }, { data: paymentMethods }, { data: tx }] = await Promise.all([
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("projects").select("id, name").order("name"),
    supabase.from("payment_methods").select("*").order("sort_order"),
    supabase.from("transactions").select("*").eq("id", id).single(),
  ]);

  if (!tx) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">거래 수정</h1>
      <TransactionForm
        clients={clients ?? []}
        projects={projects ?? []}
        paymentMethods={paymentMethods ?? []}
        initial={tx}
        action={updateTransactionRecord}
      />
    </div>
  );
}
