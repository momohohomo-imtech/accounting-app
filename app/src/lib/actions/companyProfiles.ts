"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { QuoteCompanyInfo } from "@/lib/companyProfile";

// 견적서 공급자 목록(company_profiles, 089) — 견적서 목록 화면의 "공급자 목록"(CreatePanel/EntityTable)과
// 견적서 인쇄화면의 "공급자 목록에 추가"가 씀. 기본 공급자는 하나만(표의 유일 인덱스)이라, 새로 기본으로 고르면
// 다른 줄의 기본을 먼저 끔.

type Supabase = Awaited<ReturnType<typeof createClient>>;
type ProfileRow = {
  company_name: string;
  representative_name: string | null;
  biz_reg_no: string | null;
  address: string | null;
  biz_type: string | null;
  biz_item: string | null;
  phone: string | null;
  fax: string | null;
  is_default: boolean;
};

function parse(formData: FormData): ProfileRow {
  const text = (key: string) => String(formData.get(key) ?? "").trim() || null;
  return {
    company_name: String(formData.get("company_name") ?? "").trim(),
    representative_name: text("representative_name"),
    biz_reg_no: text("biz_reg_no"),
    address: text("address"),
    biz_type: text("biz_type"),
    biz_item: text("biz_item"),
    phone: text("phone"),
    fax: text("fax"),
    is_default: formData.get("is_default") === "on",
  };
}

// SQL 089를 아직 실행 안 해서 표가 없을 때는 알아볼 수 있는 안내로.
function message(error: { message: string }) {
  if (/company_profiles/.test(error.message) && /schema cache|does not exist/.test(error.message)) {
    return "공급자 목록 표가 아직 없습니다 — Supabase SQL Editor에서 089_company_profiles.sql을 먼저 실행해 주세요.";
  }
  return error.message;
}

function revalidate() {
  revalidatePath("/projects");
  revalidatePath("/quotes/[id]/edit", "page");
  revalidatePath("/quotes/new");
}

async function clearDefault(supabase: Supabase, exceptId?: string) {
  let query = supabase.from("company_profiles").update({ is_default: false }).eq("is_default", true);
  if (exceptId) query = query.neq("id", exceptId);
  const { error } = await query;
  return error;
}

async function insertProfile(supabase: Supabase, row: ProfileRow): Promise<{ error?: string }> {
  if (!row.company_name) return { error: "상호를 입력해 주세요." };
  // 기본 공급자가 아직 없으면(첫 공급자 등) 새로 넣는 공급자를 기본으로.
  const { count } = await supabase
    .from("company_profiles")
    .select("id", { count: "exact", head: true })
    .eq("is_default", true);
  if (!count) row.is_default = true;
  else if (row.is_default) {
    const error = await clearDefault(supabase);
    if (error) return { error: message(error) };
  }
  const { error } = await supabase.from("company_profiles").insert(row);
  if (error) return { error: message(error) };
  revalidate();
  return {};
}

export async function createCompanyProfile(formData: FormData) {
  const supabase = await createClient();
  const result = await insertProfile(supabase, parse(formData));
  if (result.error) return result;
}

// 견적서 인쇄화면에서 직접 입력한 공급자 정보를 그대로 목록에 추가.
export async function addCompanyProfileFromQuote(info: QuoteCompanyInfo): Promise<{ error?: string }> {
  const supabase = await createClient();
  const text = (v: string) => v.trim() || null;
  return insertProfile(supabase, {
    company_name: info.companyName.trim(),
    representative_name: text(info.representativeName),
    biz_reg_no: text(info.bizRegNo),
    address: text(info.address),
    biz_type: text(info.bizType),
    biz_item: text(info.bizItem),
    phone: text(info.phone),
    fax: text(info.fax),
    is_default: false,
  });
}

export async function updateCompanyProfile(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const row = parse(formData);
  if (!row.company_name) return { error: "상호를 입력해 주세요." };
  if (row.is_default) {
    const error = await clearDefault(supabase, id);
    if (error) return { error: message(error) };
  }
  const { error } = await supabase
    .from("company_profiles")
    .update({ ...row, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: message(error) };
  revalidate();
}

// 목록에서 지워도 이미 이 공급자로 저장한 견적서는 그대로(견적서마다 따로 저장돼 있음).
export async function deleteCompanyProfile(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("company_profiles").delete().eq("id", id);
  if (error) return { error: message(error) };
  revalidate();
}
