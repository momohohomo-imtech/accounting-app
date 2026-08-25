import { createClient } from "@supabase/supabase-js";

// 쿠키/로그인 세션이 없는 곳(cron 등)에서 쓰는 서비스 롤 클라이언트.
// RLS를 무시하므로 사용자 요청 경로에서는 절대 쓰지 말 것.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
