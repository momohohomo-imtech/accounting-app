"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabaseFetchAll";
import { profileToCompanyInfo, type CompanyProfileRow, type QuoteCompanyInfo } from "@/lib/companyProfile";

export type QuoteItemInput = {
  item_name: string;
  spec: string;
  quantity: number | null;
  unit_price: number | null;
  amount: number;
  handling_fee_pct: number;
  note: string;
  unit: string;
  group_label: string | null;
  is_group_summary: boolean;
};

export type QuoteInput = {
  title: string;
  client_id: string | null;
  client_name_raw: string | null;
  project_id: string | null;
  status: string;
  valid_until: string | null;
  memo: string | null;
  target_amount: number | null;
  items: QuoteItemInput[];
};

async function saveItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  quoteId: string,
  items: QuoteItemInput[]
): Promise<{ error?: string }> {
  // 새 품목을 먼저 넣고 예전 품목을 지움 — 넣기가 실패해도 예전 품목은 그대로 남게(예전엔 먼저 지워서, 넣기가 실패하면
  // 품목이 빈 문서가 됐음).
  const { data: oldItems, error: oldError } = await supabase.from("quote_items").select("id").eq("quote_id", quoteId);
  if (oldError) return { error: oldError.message };
  const rows = items
    .filter((it) => it.item_name || it.amount)
    .map((it, i) => ({
      quote_id: quoteId,
      item_name: it.item_name || null,
      spec: it.spec || null,
      quantity: it.quantity,
      unit_price: it.unit_price,
      amount: it.amount,
      handling_fee_pct: it.handling_fee_pct || 0,
      note: it.note || null,
      unit: it.unit || null,
      group_label: it.group_label || null,
      is_group_summary: it.is_group_summary || false,
      sort_order: i,
    }));
  if (rows.length > 0) {
    const { error } = await supabase.from("quote_items").insert(rows);
    if (error) return { error: error.message };
  }
  const oldIds = (oldItems ?? []).map((r) => r.id as string);
  if (oldIds.length > 0) {
    const { error } = await supabase.from("quote_items").delete().in("id", oldIds);
    if (error) return { error: `새 품목은 저장됐지만 예전 품목을 지우지 못했습니다(한 번 더 저장하면 정리됩니다): ${error.message}` };
  }
  return {};
}

// supplierProfileId: 새 견적서 작성 화면에서 고른 공급자(company_profiles) — 그 정보를 이 견적서의 공급자로
// 저장해 둬서, 나중에 목록을 고치거나 기본 공급자를 바꿔도 이 견적서는 그대로.
export async function createQuote(
  input: QuoteInput,
  supplierProfileId?: string | null
): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let companyInfo: QuoteCompanyInfo | null = null;
  if (supplierProfileId) {
    const { data: profile } = await supabase
      .from("company_profiles")
      .select("*")
      .eq("id", supplierProfileId)
      .maybeSingle();
    if (profile) companyInfo = profileToCompanyInfo(profile as CompanyProfileRow);
  }

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
      target_amount: input.target_amount,
      company_info: companyInfo,
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
      target_amount: input.target_amount,
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

// 견적서 인쇄화면의 공급자 정보(목록에서 고르거나 직접 고친 값)를 이 견적서에만 저장 — 공급자 목록·다른 견적서엔 영향 없음.
export async function updateQuoteCompanyInfo(id: string, companyInfo: QuoteCompanyInfo): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").update({ company_info: companyInfo }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/quotes/${id}/edit`);
  return {};
}

export async function deleteQuoteRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.from("quotes").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/projects");
}

// 기존 프로젝트의 매입 내역 + 대행구매 내역을 그대로 견적 품목 초안으로 불러오기.
export async function fetchProjectPurchaseItems(projectId: string): Promise<QuoteItemInput[]> {
  const supabase = await createClient();
  const [transactions, agencyPurchases] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase
        .from("transactions")
        .select("item_name, quantity, unit_price, purchase_amount, purchase_vat")
        .eq("project_id", projectId)
        .eq("type", "매입")
        .order("trans_date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
    ),
    fetchAllRows((from, to) =>
      supabase
        .from("project_agency_purchases")
        .select("item_name, amount, memo")
        .eq("project_id", projectId)
        .order("id", { ascending: true })
        .range(from, to)
    ),
  ]);

  const fromTransactions = (transactions ?? []).map((t) => ({
    item_name: t.item_name ?? "",
    spec: "",
    quantity: t.quantity,
    unit_price: t.unit_price,
    amount: t.purchase_amount + t.purchase_vat,
    handling_fee_pct: 0,
    note: "",
    unit: "",
    group_label: null,
    is_group_summary: false,
  }));

  const fromAgencyPurchases = (agencyPurchases ?? []).map((a) => ({
    item_name: a.item_name ?? "",
    spec: "대행구매",
    quantity: null,
    unit_price: null,
    amount: a.amount,
    handling_fee_pct: 0,
    note: a.memo ?? "",
    unit: "",
    group_label: null,
    is_group_summary: false,
  }));

  return [...fromTransactions, ...fromAgencyPurchases];
}
