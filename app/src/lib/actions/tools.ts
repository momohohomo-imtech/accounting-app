"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parse(formData: FormData) {
  const sortOrderRaw = String(formData.get("sort_order") ?? "").trim();
  return {
    name: String(formData.get("name") ?? "").trim(),
    sort_order: sortOrderRaw === "" ? 0 : Number(sortOrderRaw) || 0,
    note: String(formData.get("note") ?? "") || null,
    linked_tool_ids: formData.getAll("linked_tool_id").map(String).filter(Boolean),
    text_color: String(formData.get("text_color") ?? "").trim() || null,
    background_color: String(formData.get("background_color") ?? "").trim() || null,
    default_quantity: String(formData.get("default_quantity") ?? "").trim() || null,
    for_access_pass: formData.get("for_access_pass") === "true",
  };
}

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// 같은 순번 그룹의 맨 뒤 자리 — position을 항상 0으로 두면 그 순번에 이미 있던 항목과 값이 겹쳐서(동점) 위/아래로
// 옮겨도 순서가 안 바뀌는 것처럼 보일 수 있음. 새로 만들 때와 다른 순번 그룹으로 옮길 때 씀.
async function nextPositionIn(supabase: ServerClient, sortOrder: number) {
  const { data: lastRow } = await supabase
    .from("tools")
    .select("position")
    .eq("sort_order", sortOrder)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (lastRow?.position ?? -1) + 1;
}

export async function createTool(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const values = parse(formData);
  if (!values.name) return { error: "공구명을 입력해주세요." };

  const position = await nextPositionIn(supabase, values.sort_order);
  const { error } = await supabase.from("tools").insert({ ...values, position, created_by: user?.id ?? null });
  if (error) return { error: error.message };

  revalidatePath("/quality-construction");
}

export async function updateTool(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const values = parse(formData);
  if (!id || !values.name) return { error: "공구명을 입력해주세요." };

  // 다른 순번 그룹으로 옮기면 그 그룹 맨 뒤에 붙임 — 예전엔 원래 자리 번호를 그대로 가져가서 새 그룹의 공구와 번호가
  // 같아지면(동점) ▲▼를 눌러도 순서가 안 바뀌었음.
  const { data: current, error: currentError } = await supabase.from("tools").select("sort_order").eq("id", id).maybeSingle();
  if (currentError) return { error: currentError.message };
  if (!current) return { error: "수정 대상을 찾을 수 없거나 권한이 없습니다." };
  const moved = current.sort_order !== values.sort_order ? { position: await nextPositionIn(supabase, values.sort_order) } : {};

  // update()만 쓰면 조건에 맞는 행이 0개여도 에러 없이 "성공"으로 끝나서, 저장이
  // 조용히 안 먹힌 것처럼 보일 수 있었음(권한 문제 등으로 실제로는 0행 수정) —
  // select()로 실제 수정된 행을 받아서 없으면 에러로 알려줌.
  const { data, error } = await supabase.from("tools").update({ ...values, ...moved }).eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "수정 대상을 찾을 수 없거나 권한이 없습니다." };

  revalidatePath("/quality-construction");
}

export async function deleteTool(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 항목입니다." };

  const { error } = await supabase.from("tools").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/quality-construction");
}

// 같은 순번 그룹 안에서 바로 옆 항목과 위/아래로 자리 바꾸기 — 그룹 전체의 position을
// 다시 매기던 이전 방식은 그룹 크기(N)만큼 UPDATE가 나가서(예: 소공구 27개면 클릭 한 번에
// 27번 요청) 화면이 느려지는 원인이었음. 실제로 옮길 두 항목의 position 값만 서로
// 바꾸면 되므로 보통 딱 2번의 UPDATE로 끝남(두 번호가 같을 때만 그룹 전체를 다시 매김).
export async function swapToolPosition(formData: FormData) {
  const supabase = await createClient();
  const idA = String(formData.get("id_a") ?? "");
  const idB = String(formData.get("id_b") ?? "");
  if (!idA || !idB) return { error: "잘못된 요청입니다." };

  const { data: rows, error } = await supabase.from("tools").select("id, position, sort_order").in("id", [idA, idB]);
  if (error) return { error: error.message };
  const rowA = rows?.find((r) => r.id === idA);
  const rowB = rows?.find((r) => r.id === idB);
  if (!rowA || !rowB) return { error: "공구를 찾을 수 없습니다(다른 곳에서 지워졌을 수 있음). 새로고침해 주세요." };
  const posA = rowA.position ?? 0;
  const posB = rowB.position ?? 0;

  // 두 공구 번호가 같으면(예전에 다른 그룹에서 옮겨 온 공구) 서로 바꿔도 그대로라 버튼이 안 먹었음 — 이때만 그룹 전체를
  // 화면 순서(번호 → 이름)대로 0,1,2…로 다시 매기면서 두 공구 자리를 바꿈.
  if (posA === posB) {
    if (rowA.sort_order !== rowB.sort_order) return { error: "같은 순번 그룹 안에서만 옮길 수 있습니다." };
    const { data: group, error: groupError } = await supabase
      .from("tools")
      .select("id, position")
      .eq("sort_order", rowA.sort_order)
      .order("position")
      .order("name")
      .order("id");
    if (groupError) return { error: groupError.message };
    const ids = (group ?? []).map((r) => r.id);
    const iA = ids.indexOf(idA);
    const iB = ids.indexOf(idB);
    if (iA < 0 || iB < 0) return { error: "공구를 찾을 수 없습니다. 새로고침해 주세요." };
    [ids[iA], ids[iB]] = [ids[iB], ids[iA]];
    const before = new Map((group ?? []).map((r) => [r.id, r.position]));
    for (const [i, id] of ids.entries()) {
      if (before.get(id) === i) continue;
      const { error: renumberError } = await supabase.from("tools").update({ position: i }).eq("id", id);
      if (renumberError) return { error: `순서를 바꾸지 못했습니다: ${renumberError.message}` };
    }
    revalidatePath("/quality-construction");
    return;
  }

  // 하나씩 바꾸고 결과를 확인 — 예전엔 두 저장 결과를 버려서 실패해도 성공처럼 보였고, 한쪽만 바뀌면 두 공구 순번이 같아졌음
  const { error: errorA } = await supabase.from("tools").update({ position: posB }).eq("id", idA);
  if (errorA) return { error: `순서를 바꾸지 못했습니다: ${errorA.message}` };
  const { error: errorB } = await supabase.from("tools").update({ position: posA }).eq("id", idB);
  if (errorB) {
    await supabase.from("tools").update({ position: posA }).eq("id", idA);
    return { error: `순서를 바꾸지 못했습니다: ${errorB.message}` };
  }
  revalidatePath("/quality-construction");
}
