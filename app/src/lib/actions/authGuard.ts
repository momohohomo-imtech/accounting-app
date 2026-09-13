import { createClient } from "@/lib/supabase/server";

// 계정 관리 등 admin 전용 서버 액션에서 공용으로 쓰는 권한 체크.
export async function requireAdmin(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return { ok: false, error: "권한이 없습니다." };
  return { ok: true, userId: user.id };
}
