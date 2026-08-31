import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { PurchaseOrdersTable } from "@/components/PurchaseOrdersTable";
import { LinkButton } from "@/components/ui/Button";

export async function PurchaseOrdersSection() {
  const supabase = await createClient();
  const [{ data: purchaseOrders }, { data: items }] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select(
        "id, po_number, title, status, created_at, client_id, client_name_raw, clients(name), projects(name, project_code)"
      )
      .order("created_at", { ascending: false }),
    supabase.from("purchase_order_items").select("purchase_order_id, amount"),
  ]);

  const totalByPo = new Map<string, number>();
  for (const it of items ?? []) {
    totalByPo.set(it.purchase_order_id, (totalByPo.get(it.purchase_order_id) ?? 0) + it.amount);
  }

  const rows = (purchaseOrders ?? []).map((po) => {
    const client = one(po.clients) as { name: string } | null;
    const project = one(po.projects) as { name: string; project_code: string | null } | null;
    return {
      id: po.id,
      po_number: po.po_number,
      title: po.title,
      clientName: client?.name ?? po.client_name_raw,
      projectLabel: project ? `${project.project_code ?? ""} ${project.name}`.trim() : null,
      status: po.status,
      total: totalByPo.get(po.id) ?? 0,
      created_at: po.created_at,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">발주서</h2>
        <LinkButton href="/purchase-orders/new">+ 새 발주서</LinkButton>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <PurchaseOrdersTable rows={rows} />
      </div>
    </div>
  );
}
