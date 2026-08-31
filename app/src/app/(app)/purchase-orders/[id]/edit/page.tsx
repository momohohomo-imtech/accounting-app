import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { PurchaseOrderForm } from "@/components/PurchaseOrderForm";
import { PurchaseOrderPrintView } from "@/components/PurchaseOrderPrintView";

export default async function EditPurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: purchaseOrder }, { data: items }, { data: clients }, { data: sites }, { data: projects }] =
    await Promise.all([
      supabase.from("purchase_orders").select("*, clients(name), projects(name, project_code)").eq("id", id).single(),
      supabase.from("purchase_order_items").select("*").eq("purchase_order_id", id).order("sort_order", { ascending: true }),
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("sites").select("id, name, clients(name)").order("name"),
      supabase.from("projects").select("id, name, site_id, status, year, project_code").order("name"),
    ]);

  if (!purchaseOrder) notFound();

  const siteOptions = (sites ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    client_name: (one(s.clients) as { name: string } | undefined)?.name ?? null,
  }));

  const clientName = (one(purchaseOrder.clients) as { name: string } | null)?.name ?? purchaseOrder.client_name_raw;
  const projectInfo = one(purchaseOrder.projects) as { name: string; project_code: string | null } | null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold text-slate-900">
          발주서 수정 <span className="font-mono text-base font-normal text-slate-400">{purchaseOrder.po_number}</span>
        </h1>
      </div>

      <div className="print:hidden">
        <PurchaseOrderForm
          clients={clients ?? []}
          sites={siteOptions}
          projects={projects ?? []}
          purchaseOrderId={purchaseOrder.id}
          initial={{
            title: purchaseOrder.title,
            client_id: purchaseOrder.client_id,
            client_name_raw: purchaseOrder.client_name_raw,
            project_id: purchaseOrder.project_id,
            status: purchaseOrder.status,
            expected_date: purchaseOrder.expected_date,
            memo: purchaseOrder.memo,
          }}
          initialItems={(items ?? []).map((it) => ({
            item_name: it.item_name ?? "",
            spec: it.spec ?? "",
            quantity: it.quantity,
            unit_price: it.unit_price,
            amount: it.amount,
          }))}
        />
      </div>

      <PurchaseOrderPrintView
        purchaseOrder={{
          po_number: purchaseOrder.po_number,
          title: purchaseOrder.title,
          clientName,
          projectLabel: projectInfo ? `${projectInfo.project_code ?? ""} ${projectInfo.name}`.trim() : null,
          expected_date: purchaseOrder.expected_date,
          memo: purchaseOrder.memo,
          created_at: purchaseOrder.created_at,
        }}
        items={items ?? []}
      />
    </div>
  );
}
