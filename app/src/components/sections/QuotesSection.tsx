import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { computeConfirmedAmount, isVisibleQuoteItem } from "@/lib/quoteCalc";
import { QuotesTable } from "@/components/QuotesTable";
import { LinkButton } from "@/components/ui/Button";
import { fetchAllRows } from "@/lib/supabaseFetchAll";

export async function QuotesSection() {
  const supabase = await createClient();
  type QuoteRow = {
    id: string;
    quote_number: string;
    title: string;
    status: string;
    created_at: string;
    client_id: string | null;
    client_name_raw: string | null;
    clients: { name: string } | { name: string }[] | null;
    projects: { name: string; project_code: string | null } | { name: string; project_code: string | null }[] | null;
  };
  type QuoteItemRow = {
    quote_id: string;
    amount: number;
    handling_fee_pct: number | null;
    group_label: string | null;
    is_group_summary: boolean;
  };
  const [quotes, items] = await Promise.all([
    fetchAllRows<QuoteRow>((from, to) =>
      supabase
        .from("quotes")
        .select("id, quote_number, title, status, created_at, client_id, client_name_raw, clients(name), projects(name, project_code)")
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<QuoteItemRow>((from, to) =>
      supabase
        .from("quote_items")
        .select("quote_id, amount, handling_fee_pct, group_label, is_group_summary")
        .order("id", { ascending: true })
        .range(from, to)
    ),
  ]);

  const totalByQuote = new Map<string, number>();
  for (const it of items.filter(isVisibleQuoteItem)) {
    const confirmed = computeConfirmedAmount(it.amount, it.handling_fee_pct ?? 0);
    totalByQuote.set(it.quote_id, (totalByQuote.get(it.quote_id) ?? 0) + confirmed);
  }

  const rows = quotes.map((q) => {
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
