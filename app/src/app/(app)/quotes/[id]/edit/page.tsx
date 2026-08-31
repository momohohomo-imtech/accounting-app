import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { QuoteForm } from "@/components/QuoteForm";
import { QuotePrintView } from "@/components/QuotePrintView";

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: quote }, { data: items }, { data: clients }, { data: sites }, { data: projects }] = await Promise.all([
    supabase.from("quotes").select("*, clients(name), projects(name, project_code)").eq("id", id).single(),
    supabase.from("quote_items").select("*").eq("quote_id", id).order("sort_order", { ascending: true }),
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("sites").select("id, name, clients(name)").order("name"),
    supabase.from("projects").select("id, name, site_id, status, year, project_code").order("name"),
  ]);

  if (!quote) notFound();

  const siteOptions = (sites ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    client_name: (one(s.clients) as { name: string } | undefined)?.name ?? null,
  }));

  const clientName = (one(quote.clients) as { name: string } | null)?.name ?? quote.client_name_raw;
  const projectInfo = one(quote.projects) as { name: string; project_code: string | null } | null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold text-slate-900">
          견적서 수정 <span className="font-mono text-base font-normal text-slate-400">{quote.quote_number}</span>
        </h1>
      </div>

      <div className="print:hidden">
        <QuoteForm
          clients={clients ?? []}
          sites={siteOptions}
          projects={projects ?? []}
          quoteId={quote.id}
          initial={{
            title: quote.title,
            client_id: quote.client_id,
            client_name_raw: quote.client_name_raw,
            project_id: quote.project_id,
            status: quote.status,
            valid_until: quote.valid_until,
            memo: quote.memo,
            target_amount: quote.target_amount,
          }}
          initialItems={(items ?? []).map((it) => ({
            item_name: it.item_name ?? "",
            spec: it.spec ?? "",
            quantity: it.quantity,
            unit_price: it.unit_price,
            amount: it.amount,
            handling_fee_pct: it.handling_fee_pct ?? 0,
            note: it.note ?? "",
            unit: it.unit ?? "",
            group_label: it.group_label ?? null,
            is_group_summary: it.is_group_summary ?? false,
          }))}
        />
      </div>

      <QuotePrintView
        quote={{
          quote_number: quote.quote_number,
          title: quote.title,
          clientName,
          projectLabel: projectInfo ? `${projectInfo.project_code ?? ""} ${projectInfo.name}`.trim() : null,
          valid_until: quote.valid_until,
          memo: quote.memo,
          created_at: quote.created_at,
        }}
        items={items ?? []}
      />
    </div>
  );
}
