import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { PurchaseOrderForm } from "@/components/PurchaseOrderForm";

export default async function NewPurchaseOrderPage() {
  const supabase = await createClient();
  const [{ data: clients }, { data: sites }, { data: projects }] = await Promise.all([
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("sites").select("id, name, clients(name)").order("name"),
    supabase.from("projects").select("id, name, site_id, status, year, project_code").order("name"),
  ]);

  const siteOptions = (sites ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    client_name: (one(s.clients) as { name: string } | undefined)?.name ?? null,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">발주서 작성</h1>
      <PurchaseOrderForm clients={clients ?? []} sites={siteOptions} projects={projects ?? []} />
    </div>
  );
}
