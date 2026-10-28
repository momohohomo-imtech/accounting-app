import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// 로그인한 계정 — 한 요청 안에서는 한 번만 조회(레이아웃·화면이 같이 씀).
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// 로그인한 계정의 역할(admin/staff/tax_agent/viewer).
export const getCurrentRole = cache(async (): Promise<string | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  return data?.role ?? null;
});
