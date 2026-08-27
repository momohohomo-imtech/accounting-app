import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// service_role 키를 쓰는 관리자 전용 클라이언트 — RLS를 우회하므로 절대 클라이언트 컴포넌트에서
// import하면 안 되고, "use server" 액션 안에서만 써야 함.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다. .env.local에 추가해주세요.");
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
