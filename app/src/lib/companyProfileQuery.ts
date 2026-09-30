import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompanyProfileRow } from "@/lib/companyProfile";

// 견적서 공급자 목록(company_profiles, 089) — 기본 공급자가 맨 앞, 나머지는 상호순. 몇 줄뿐이라 fetchAllRows 필요 없음.
// SQL 089 실행 전이면 error가 채워져 옴 — 화면은 목록 없이(예전처럼 직접 입력) 동작.
export function fetchCompanyProfiles(supabase: SupabaseClient) {
  return supabase
    .from("company_profiles")
    .select("id, company_name, representative_name, biz_reg_no, address, biz_type, biz_item, phone, fax, is_default")
    .order("is_default", { ascending: false })
    .order("company_name")
    .overrideTypes<CompanyProfileRow[], { merge: false }>();
}
