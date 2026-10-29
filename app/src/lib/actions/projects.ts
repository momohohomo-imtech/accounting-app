"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { nowKst } from "@/lib/kstDate";
import { PROJECT_LINKS, deleteBlockReason, deleteErrorMessage } from "@/lib/deleteGuard";

function parse(formData: FormData) {
  const estimated = formData.get("contract_amount_estimated") === "on";
  return {
    site_id: String(formData.get("site_id")),
    parent_project_id: String(formData.get("parent_project_id") ?? "") || null,
    name: String(formData.get("name") ?? ""),
    status: String(formData.get("status") ?? "ongoing"),
    is_service: formData.get("is_service") === "on",
    start_date: String(formData.get("start_date") ?? "") || null,
    end_date: String(formData.get("end_date") ?? "") || null,
    progress_pct: formData.get("progress_pct") ? Number(formData.get("progress_pct")) : 0,
    year: Number(formData.get("year") ?? nowKst().year),
    quote_amount: formData.get("quote_amount") ? Number(formData.get("quote_amount")) : null,
    contract_amount: formData.get("contract_amount") ? Number(formData.get("contract_amount")) : null,
    contract_amount_estimated: estimated,
    // 두 구분은 동시에 체크될 수 없으므로, 예상금액이 체크된 경우 최소금액 산정액은 무시한다.
    contract_amount_minimum: !estimated && formData.get("contract_amount_minimum") === "on",
    order_date: String(formData.get("order_date") ?? "") || null,
    memo: String(formData.get("memo") ?? "") || null,
    // 확인 필요/우선순위 등 사용자가 직접 지정하는 강조색 — 지정되면 자동 상태색 대신 이 색을 씀.
    highlight_color: String(formData.get("highlight_color") ?? "") || null,
  };
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

// 귀속은 한 단계만(어미 ← 하위) — 예전에 3단으로 저장된 자료는 화면·계산에서 맨 위 어미 묶음으로 보지만(lib/projectProfit.ts의
// topProjectOf), 새로 3단을 만들지는 않게. 새로 고르는 귀속만 확인(예전 3단 자료도 다른 칸을 고칠 때는 그대로 저장되게).
async function parentError(supabase: Supabase, projectId: string | null, parentId: string | null) {
  if (!parentId) return null;
  if (parentId === projectId) return "자기 자신에게 귀속할 수 없습니다.";
  const { data: parent, error } = await supabase.from("projects").select("parent_project_id").eq("id", parentId).maybeSingle();
  if (error) return error.message;
  if (!parent) return "귀속 프로젝트를 찾을 수 없습니다.";
  if (parent.parent_project_id) {
    return "이미 다른 프로젝트에 귀속된 프로젝트에는 귀속할 수 없습니다. 그 위의 어미 프로젝트를 골라주세요.";
  }
  if (projectId) {
    const { count, error: childError } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("parent_project_id", projectId);
    if (childError) return childError.message;
    if ((count ?? 0) > 0) {
      return "하위 프로젝트가 있는 프로젝트는 다른 프로젝트에 귀속할 수 없습니다. 하위 프로젝트의 귀속을 먼저 바꿔주세요.";
    }
  }
  return null;
}

export async function createProjectRecord(formData: FormData) {
  try {
    const supabase = await createClient();
    const row = parse(formData);
    const invalidParent = await parentError(supabase, null, row.parent_project_id);
    if (invalidParent) return { error: invalidParent };
    const { error } = await supabase.from("projects").insert(row);
    if (error) return { error: error.message };
    revalidatePath("/projects");
    revalidatePath("/reports");
  } catch (err) {
    // 예상 못 한 예외까지 잡아서 그대로 반환 — 프로덕션에서 서버 액션이 그냥 throw하면
    // 진짜 메시지 대신 "Minified React error #441" 같은 걸로 가려지는 문제(HANDOFF 교훈)를 피함.
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updateProjectRecord(formData: FormData) {
  try {
    const supabase = await createClient();
    const id = String(formData.get("id"));
    const row = parse(formData);
    const { data: current, error: currentError } = await supabase
      .from("projects")
      .select("parent_project_id")
      .eq("id", id)
      .maybeSingle();
    if (currentError) return { error: currentError.message };
    if (row.parent_project_id !== (current?.parent_project_id ?? null)) {
      const invalidParent = await parentError(supabase, id, row.parent_project_id);
      if (invalidParent) return { error: invalidParent };
    }
    const { error } = await supabase.from("projects").update(row).eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/projects");
    revalidatePath("/reports");
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// 연말 점검 — 12월 31일까지 세금계산서를 다 못 끊는 프로젝트(귀속 하위 포함)의 귀속 연도를 다음 해로(사용자 운영 방식:
// 계산서를 끊는 해가 그 프로젝트의 매출·이익 해). 금액은 그대로. 지금 fromYear인 프로젝트만 옮김 — 두 번 눌러도 두 해
// 뒤로 가지 않게.
export async function moveProjectsToNextYear(ids: string[], fromYear: number) {
  try {
    if (ids.length === 0) return { error: "옮길 프로젝트를 선택해주세요." };
    if (!Number.isInteger(fromYear)) return { error: "연도가 올바르지 않습니다." };
    const supabase = await createClient();
    const { error } = await supabase.from("projects").update({ year: fromYear + 1 }).in("id", ids).eq("year", fromYear);
    if (error) return { error: error.message };
    revalidatePath("/projects");
    revalidatePath("/reports");
    revalidatePath("/dashboard");
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updateProjectMemo(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const memo = String(formData.get("memo") ?? "") || null;
  const { error } = await supabase.from("projects").update({ memo }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/projects");
  revalidatePath("/reports");
}

export async function updateProjectSettlementFinalized(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const settlementFinalized = formData.get("settlement_finalized") === "on";
  const { error } = await supabase.from("projects").update({ settlement_finalized: settlementFinalized }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/projects");
  revalidatePath("/reports");
}

// 수주액 예상금액/최소금액 산정액은 프로젝트 수정 폼과 동일하게 서로 배타적 —
// 하나를 켜면 다른 하나는 자동으로 꺼짐(보고서 팝업에서 바로 토글할 때도 동일하게 유지).
export async function updateProjectContractAmountFlag(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const field = String(formData.get("field"));
  if (field !== "contract_amount_estimated" && field !== "contract_amount_minimum") return { error: "잘못된 항목입니다." };
  const checked = formData.get("checked") === "on";
  const other = field === "contract_amount_estimated" ? "contract_amount_minimum" : "contract_amount_estimated";
  const update: Record<string, boolean> = { [field]: checked };
  if (checked) update[other] = false;
  const { error } = await supabase.from("projects").update(update).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/projects");
  revalidatePath("/reports");
}

// 거래·작업일지·대행구매·공사 메모 등이 연결된 프로젝트는 막음 — 지우면 대행구매·공사 메모 등은 같이 지워지고 거래는
// 프로젝트 연결이 끊겨 손익에서 빠졌음(작업일지가 있으면 DB가 막는데 예전엔 오류를 화면에 안 보여서 그냥 안 지워졌음).
export async function deleteProjectRecord(formData: FormData) {
  try {
    const supabase = await createClient();
    const id = String(formData.get("id"));
    const blocked = await deleteBlockReason(
      supabase,
      PROJECT_LINKS,
      id,
      "이 프로젝트에",
      "다른 프로젝트로 옮기거나 먼저 지운 뒤 삭제해주세요."
    );
    if (blocked) return { error: blocked };
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) return { error: deleteErrorMessage(error) };
    revalidatePath("/projects");
    revalidatePath("/reports");
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
