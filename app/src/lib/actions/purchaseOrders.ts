"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PurchaseOrderItemInput = {
  item_name: string;
  spec: string;
  quantity: number | null;
  unit_price: number | null;
  amount: number;
};

export type PurchaseOrderInput = {
  title: string;
  client_id: string | null;
  client_name_raw: string | null;
  project_id: string | null;
  status: string;
  expected_date: string | null;
  memo: string | null;
  items: PurchaseOrderItemInput[];
};

async function saveItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  purchaseOrderId: string,
  items: PurchaseOrderItemInput[]
): Promise<{ error?: string }> {
  await supabase.from("purchase_order_items").delete().eq("purchase_order_id", purchaseOrderId);
  const rows = items
    .filter((it) => it.item_name || it.amount)
    .map((it, i) => ({
      purchase_order_id: purchaseOrderId,
      item_name: it.item_name || null,
      spec: it.spec || null,
      quantity: it.quantity,
      unit_price: it.unit_price,
      amount: it.amount,
      sort_order: i,
    }));
  if (rows.length > 0) {
    const { error } = await supabase.from("purchase_order_items").insert(rows);
    if (error) return { error: error.message };
  }
  return {};
}

export async function createPurchaseOrder(input: PurchaseOrderInput): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: po, error } = await supabase
    .from("purchase_orders")
    .insert({
      title: input.title,
      client_id: input.client_id,
      client_name_raw: input.client_name_raw,
      project_id: input.project_id,
      status: input.status,
      expected_date: input.expected_date,
      memo: input.memo,
      created_by: user?.id ?? null,
    })
    .select()
    .single();
  if (error || !po) return { error: error?.message ?? "발주서 생성에 실패했습니다." };

  const itemsResult = await saveItems(supabase, po.id, input.items);
  if (itemsResult.error) return itemsResult;

  revalidatePath("/projects");
  return { id: po.id as string };
}

export async function updatePurchaseOrder(id: string, input: PurchaseOrderInput): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("purchase_orders")
    .update({
      title: input.title,
      client_id: input.client_id,
      client_name_raw: input.client_name_raw,
      project_id: input.project_id,
      status: input.status,
      expected_date: input.expected_date,
      memo: input.memo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  const itemsResult = await saveItems(supabase, id, input.items);
  if (itemsResult.error) return itemsResult;

  revalidatePath("/projects");
  revalidatePath(`/purchase-orders/${id}/edit`);
  return {};
}

export async function deletePurchaseOrderRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  await supabase.from("purchase_orders").delete().eq("id", id);
  revalidatePath("/projects");
}
