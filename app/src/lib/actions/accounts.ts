"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/actions/authGuard";
import { TAX_AGENT_SUSPEND_DURATION } from "@/lib/taxAgentSuspend";
import { PROTECTED_OWNER_EMAIL } from "@/lib/protectedAccount";

export type Role = "admin" | "staff" | "tax_agent";
const ROLES: Role[] = ["admin", "staff", "tax_agent"];

export type Account = {
  id: string;
  email: string;
  name: string;
  role: Role;
  suspended: boolean;
  resuspendAt: string | null;
  // public.users엔 있지만 auth.users엔 없는 상태(과거 수기 등록 등으로 어긋난 데이터) —
  // 로그인 자체가 이미 불가능한 "유령" 행이라 비활성화/재활성화 대상이 아님.
  authMissing: boolean;
};

export async function getAccounts(): Promise<Account[]> {
  const guard = await requireAdmin();
  if (!guard.ok) return [];

  const supabase = await createClient();
  const { data: rows } = await supabase.from("users").select("id, email, name, role, resuspend_at").order("created_at");
  if (!rows || rows.length === 0) return [];

  try {
    const admin = createAdminClient();
    return await Promise.all(
      rows.map(async (r) => {
        const { data } = await admin.auth.admin.getUserById(r.id);
        if (!data.user) {
          return {
            id: r.id,
            email: r.email,
            name: r.name,
            role: r.role as Role,
            suspended: false,
            resuspendAt: null,
            authMissing: true,
          };
        }

        const bannedUntil = data.user.banned_until;
        let suspended = Boolean(bannedUntil && new Date(bannedUntil).getTime() > Date.now());
        let resuspendAt: string | null = r.resuspend_at;

        // 예약된 재정지 시각이 지났는데 아직 정지 안 됐으면 지금 정지시키고 예약을 지운다.
        if (!suspended && resuspendAt && new Date(resuspendAt).getTime() <= Date.now()) {
          await admin.auth.admin.updateUserById(r.id, { ban_duration: TAX_AGENT_SUSPEND_DURATION });
          await admin.from("users").update({ resuspend_at: null }).eq("id", r.id);
          suspended = true;
          resuspendAt = null;
        }

        return { id: r.id, email: r.email, name: r.name, role: r.role as Role, suspended, resuspendAt, authMissing: false };
      })
    );
  } catch {
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      role: r.role as Role,
      suspended: false,
      resuspendAt: null,
      authMissing: false,
    }));
  }
}

export async function createAccount(formData: FormData): Promise<{ error?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { error: guard.error };

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "staff");
  if (!email || !name) return { error: "이메일과 이름을 입력해주세요." };
  if (password.length < 6) return { error: "비밀번호는 6자 이상이어야 합니다." };
  if (!ROLES.includes(role as Role)) return { error: "잘못된 역할입니다." };

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (error) return { error: error.message };
    if (data.user) {
      // handle_new_user 트리거가 role 기본값(staff)으로 행을 만들어두므로, 다른 역할로
      // 만들었으면 여기서 덮어씀.
      await admin.from("users").update({ name, role }).eq("id", data.user.id);
    }
    revalidatePath("/backups");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "계정 생성 실패" };
  }
}

export async function updateAccount(formData: FormData): Promise<{ error?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { error: guard.error };

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  if (!id || !name) return { error: "이름을 입력해주세요." };
  if (!ROLES.includes(role as Role)) return { error: "잘못된 역할입니다." };

  if (id === guard.userId && role !== "admin") {
    return { error: "본인 계정의 역할은 관리자에서 다른 역할로 바꿀 수 없습니다." };
  }

  try {
    const admin = createAdminClient();
    if (role !== "admin") {
      const { data: targetRow } = await admin.from("users").select("email").eq("id", id).maybeSingle();
      if (targetRow?.email === PROTECTED_OWNER_EMAIL) {
        return { error: "이 계정은 항상 관리자로 유지되어야 해서 다른 역할로 바꿀 수 없습니다." };
      }
    }
    const { error } = await admin.from("users").update({ name, role }).eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/backups");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "계정 수정 실패" };
  }
}

export async function setAccountPassword(formData: FormData): Promise<{ error?: string }> {
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

export async function deleteAccount(formData: FormData): Promise<{ error?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { error: guard.error };

  const userId = String(formData.get("id") ?? "");
  if (!userId) return { error: "계정을 찾을 수 없습니다." };
  if (userId === guard.userId) return { error: "본인 계정은 삭제할 수 없습니다." };

  try {
    const admin = createAdminClient();
    const { data: rows } = await admin.from("users").select("id, email, role");
    const target = (rows ?? []).find((r) => r.id === userId);
    if (target?.email === PROTECTED_OWNER_EMAIL) {
      return { error: "이 계정은 삭제할 수 없습니다." };
    }
    const adminCount = (rows ?? []).filter((r) => r.role === "admin").length;
    if (target?.role === "admin" && adminCount <= 1) {
      return { error: "마지막 관리자 계정은 삭제할 수 없습니다." };
    }

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      // auth.users에 이 id가 아예 없는 상태(과거 수기 등록 등으로 어긋난 데이터) —
      // 로그인 자체가 불가능한 유령 행이므로 public.users 행만 직접 지운다.
      if (/not found/i.test(error.message)) {
        const { error: rowError } = await admin.from("users").delete().eq("id", userId);
        if (rowError) {
          return {
            error: `이 계정은 로그인 정보가 없는 상태(연결이 끊긴 기록)인데, 이미 등록된 거래·메모 등 기록이 있어 완전히 지울 수는 없습니다. 다만 로그인 자체가 이미 불가능해서 위험하지는 않습니다. (${rowError.message})`,
          };
        }
        revalidatePath("/backups");
        return {};
      }
      // 이 계정으로 등록된 거래/메모/첨부파일 등이 하나라도 있으면(created_by 외래키),
      // DB가 참조 무결성 때문에 삭제를 거부한다 — 실사용 계정은 거의 항상 여기 걸림.
      // 완전 삭제 대신 비활성화(로그인 차단)를 쓰도록 안내한다.
      return {
        error: `이 계정으로 이미 등록된 거래·메모 등 기록이 있어 완전히 삭제할 수 없습니다. 대신 "비활성화"로 로그인만 막아주세요. (${error.message})`,
      };
    }
    revalidatePath("/backups");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "계정 삭제 실패" };
  }
}

export async function suspendAccount(formData: FormData): Promise<{ error?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { error: guard.error };

  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return { error: "계정을 찾을 수 없습니다." };
  if (userId === guard.userId) return { error: "본인 계정은 비활성화할 수 없습니다." };

  try {
    const admin = createAdminClient();
    const { data: rows } = await admin.from("users").select("id, email, role");
    const target = (rows ?? []).find((r) => r.id === userId);
    if (target?.email === PROTECTED_OWNER_EMAIL) {
      return { error: "이 계정은 비활성화할 수 없습니다." };
    }
    const adminCount = (rows ?? []).filter((r) => r.role === "admin").length;
    if (target?.role === "admin" && adminCount <= 1) {
      return { error: "마지막 관리자 계정은 비활성화할 수 없습니다." };
    }

    const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: TAX_AGENT_SUSPEND_DURATION });
    if (error) {
      if (/not found/i.test(error.message)) {
        return { error: "이 계정은 로그인 정보가 없는 상태(연결이 끊긴 기록)라 비활성화할 대상이 없습니다 — 이미 로그인이 불가능합니다." };
      }
      return { error: error.message };
    }
    await admin.from("users").update({ resuspend_at: null }).eq("id", userId);
    revalidatePath("/backups");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "계정 정지 실패" };
  }
}

export async function unsuspendAccount(formData: FormData): Promise<{ error?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { error: guard.error };

  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return { error: "계정을 찾을 수 없습니다." };
  const hours = Number(formData.get("hours") ?? "");
  const resuspendAt = hours > 0 ? new Date(Date.now() + hours * 3600_000).toISOString() : null;

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
    if (error) {
      if (/not found/i.test(error.message)) {
        return { error: "이 계정은 로그인 정보가 없는 상태(연결이 끊긴 기록)입니다." };
      }
      return { error: error.message };
    }
    await admin.from("users").update({ resuspend_at: resuspendAt }).eq("id", userId);
    revalidatePath("/backups");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "정지 해제 실패" };
  }
}
