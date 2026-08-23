import { createClient } from "@/lib/supabase/server";
import { TransactionForm } from "@/components/TransactionForm";
import { createTransactionRecord } from "@/lib/actions/transactions";

export default async function NewTransactionPage() {
  const supabase = await createClient();
  const [{ data: clients }, { data: projects }] = await Promise.all([
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("projects").select("id, name").order("name"),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">매입매출 등록</h1>
      <TransactionForm clients={clients ?? []} projects={projects ?? []} action={createTransactionRecord} />
    </div>
  );
}
