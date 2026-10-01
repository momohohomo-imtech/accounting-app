import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { QuoteForm } from "@/components/QuoteForm";
import { fetchCompanyProfiles } from "@/lib/companyProfileQuery";

export default async function NewQuotePage() {
  const supabase = await createClient();
  const [{ data: clients }, { data: sites }, { data: projects }, { data: profiles }] = await Promise.all([
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("sites").select("id, name, clients(name)").order("name"),
    supabase.from("projects").select("id, name, site_id, status, year, project_code").order("name"),
    fetchCompanyProfiles(supabase),
  ]);

  const siteOptions = (sites ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    client_name: (one(s.clients) as { name: string } | undefined)?.name ?? null,
  }));

  return (
    <QuoteForm
      heading="견적서 작성"
      clients={clients ?? []}
      sites={siteOptions}
      projects={projects ?? []}
      supplierProfiles={profiles ?? []}
    />
  );
}
