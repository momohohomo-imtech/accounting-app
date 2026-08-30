import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { QuotesTable } from "@/components/QuotesTable";
import { LinkButton } from "@/components/ui/Button";

export async function QuotesSection() {
  const supabase = await createClient();
  const [{ data: quotes }, { data: items }] = await Promise.all([
    supabase
      .from("quotes")
      .select("id, quote_number, title, status, created_at, client_id, client_name_raw, clients(name), projects(name, project_code)")
      .order("created_at", { ascending: false }),
    supabase.from("quote_items").select("quote_id, amount"),
  ]);

  const totalByQuote = new Map<string, number>();
  for (const it of items ?? []) {
    totalByQuote.set(it.quote_id, (totalByQuote.get(it.quote_id) ?? 0) + it.amount);
  }

  const rows = (quotes ?? []).map((q) => {
    const client = one(q.clients) as { name: string } | null;
    const project = one(q.projects) as { name: string; project_code: string | null } | null;
    return {
      id: q.id,
      quote_number: q.quote_number,
      title: q.title,
      clientName: client?.name ?? q.client_name_raw,
      projectLabel: project ? `${project.project_code ?? ""} ${project.name}`.trim() : null,
      status: q.status,
      total: totalByQuote.get(q.id) ?? 0,
      created_at: q.created_at,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">견적서</h2>
        <LinkButton href="/quotes/new">+ 새 견적서</LinkButton>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <QuotesTable rows={rows} />
      </div>
    </div>
  );
}
