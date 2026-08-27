"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type TaxAgentAccount = { id: string; email: string; name: string; suspended: boolean };

async function requireAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return { ok: false, error: "권한이 없습니다." };
  return { ok: true };
}

// 정지: 100년짜리 ban을 걸어 관리자가 직접 해제하기 전까지 사실상 무기한 로그인 차단.
const SUSPEND_DURATION = "876000h";

export async function getTaxAgentAccounts(): Promise<TaxAgentAccount[]> {
  const guard = await requireAdmin();
  if (!guard.ok) return [];

  const supabase = await createClient();
  const { data: rows } = await supabase.from("users").select("id, email, name").eq("role", "tax_agent");
  if (!rows || rows.length === 0) return [];

  try {
    const admin = createAdminClient();
    return await Promise.all(
      rows.map(async (r) => {
        const { data } = await admin.auth.admin.getUserById(r.id);
        const bannedUntil = data.user?.banned_until;
        const suspended = Boolean(bannedUntil && new Date(bannedUntil).getTime() > Date.now());
        return { id: r.id, email: r.email, name: r.name, suspended };
      })
    );
  } catch {
    return rows.map((r) => ({ id: r.id, email: r.email, name: r.name, suspended: false }));
  }
}

export async function setTaxAgentPassword(formData: FormData): Promise<{ error?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { error: guard.error };

  const userId = String(formData.get("user_id") ?? "");
  const newPassword = String(formData.get("new_password") ?? "");
  if (!userId) return { error: "계정을 찾을 수 없습니다." };
  if (newPassword.length < 6) return { error: "비밀번호는 6자 이상이어야 합니다." };

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
    if (error) return { error: error.message };
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "비밀번호 변경 실패" };
  }
}

export async function suspendTaxAgentAccount(formData: FormData): Promise<{ error?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { error: guard.error };

  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return { error: "계정을 찾을 수 없습니다." };

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: SUSPEND_DURATION });
    if (error) return { error: error.message };
    revalidatePath("/backups");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "계정 정지 실패" };
  }
}

export async function unsuspendTaxAgentAccount(formData: FormData): Promise<{ error?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { error: guard.error };

  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return { error: "계정을 찾을 수 없습니다." };

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
    if (error) return { error: error.message };
    revalidatePath("/backups");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "정지 해제 실패" };
  }
}
