"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type QuoteItemInput = {
  item_name: string;
  spec: string;
  quantity: number | null;
  unit_price: number | null;
  amount: number;
};

export type QuoteInput = {
  title: string;
  client_id: string | null;
  client_name_raw: string | null;
  project_id: string | null;
  status: string;
  valid_until: string | null;
  memo: string | null;
  items: QuoteItemInput[];
};

async function saveItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  quoteId: string,
  items: QuoteItemInput[]
): Promise<{ error?: string }> {
  await supabase.from("quote_items").delete().eq("quote_id", quoteId);
  const rows = items
    .filter((it) => it.item_name || it.amount)
    .map((it, i) => ({
      quote_id: quoteId,
      item_name: it.item_name || null,
      spec: it.spec || null,
      quantity: it.quantity,
      unit_price: it.unit_price,
      amount: it.amount,
      sort_order: i,
    }));
  if (rows.length > 0) {
    const { error } = await supabase.from("quote_items").insert(rows);
    if (error) return { error: error.message };
  }
  return {};
}

export async function createQuote(input: QuoteInput): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: quote, error } = await supabase
    .from("quotes")
    .insert({
      title: input.title,
      client_id: input.client_id,
      client_name_raw: input.client_name_raw,
      project_id: input.project_id,
      status: input.status,
      valid_until: input.valid_until,
      memo: input.memo,
      created_by: user?.id ?? null,
    })
    .select()
    .single();
  if (error || !quote) return { error: error?.message ?? "견적서 생성에 실패했습니다." };

  const itemsResult = await saveItems(supabase, quote.id, input.items);
  if (itemsResult.error) return itemsResult;

  revalidatePath("/projects");
  return { id: quote.id as string };
}

export async function updateQuote(id: string, input: QuoteInput): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("quotes")
    .update({
      title: input.title,
      client_id: input.client_id,
      client_name_raw: input.client_name_raw,
      project_id: input.project_id,
      status: input.status,
      valid_until: input.valid_until,
      memo: input.memo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  const itemsResult = await saveItems(supabase, id, input.items);
  if (itemsResult.error) return itemsResult;

  revalidatePath("/projects");
  revalidatePath(`/quotes/${id}/edit`);
  return {};
}

export async function deleteQuoteRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  await supabase.from("quotes").delete().eq("id", id);
  revalidatePath("/projects");
}

// 기존 프로젝트의 매입 내역을 그대로 견적 품목 초안으로 불러오기.
export async function fetchProjectPurchaseItems(projectId: string): Promise<QuoteItemInput[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select("item_name, quantity, unit_price, purchase_amount, purchase_vat")
    .eq("project_id", projectId)
    .eq("type", "매입")
    .order("trans_date", { ascending: true });

  return (data ?? []).map((t) => ({
    item_name: t.item_name ?? "",
    spec: "",
    quantity: t.quantity,
    unit_price: t.unit_price,
    amount: t.purchase_amount + t.purchase_vat,
  }));
}
