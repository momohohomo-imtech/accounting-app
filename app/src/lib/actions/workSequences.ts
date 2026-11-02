"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/fileUpload";
import { normalizeAmount, type SequenceUnit } from "@/lib/workSequence";

// 공사 작업 순서표 저장·삭제(098 SQL, 사용자 요청 11/2). 순서표 한 장(머리 + 단계 전부)을 한 번에 저장 — 단계 id는 화면에서 미리
// 만든 것을 그대로 써서, 저장 도중 실패해 다시 눌러도 단계가 두 번 들어가지 않음. 날짜는 저장하지 않음(lib/workSequence.ts가 계산).

export type WorkSequenceStepInput = {
  id: string;
  content: string;
  detail: string;
  duration: number;
  overlap: number;
  done: boolean;
  done_date: string | null;
};

export type WorkSequenceInput = {
  id: string;
  project_id: string;
  title: string;
  unit: SequenceUnit;
  start_date: string | null;
  start_time: string | null;
  steps: WorkSequenceStepInput[];
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^\d{2}:\d{2}(:\d{2})?$/;
const MISSING_TABLE = new Set(["PGRST205", "42P01"]);

function dbError(error: { code?: string; message: string }) {
  return MISSING_TABLE.has(error.code ?? "")
    ? "공사 작업 순서 표가 아직 없습니다 — Supabase SQL Editor에서 098 SQL을 먼저 실행해주세요."
    : error.message;
}

export async function saveWorkSequence(input: WorkSequenceInput): Promise<{ error?: string }> {
  if (!isUuid(input.id)) return { error: "잘못된 순서표입니다. 화면을 새로 고친 뒤 다시 시도해주세요." };
  const projectId = String(input.project_id ?? "").trim();
  if (!projectId) return { error: "프로젝트를 선택해주세요." };
  const title = String(input.title ?? "").trim();
  if (!title) return { error: "제목을 입력해주세요." };
  const unit: SequenceUnit = input.unit === "hour" ? "hour" : "day";
  const startDate = input.start_date && YMD.test(input.start_date) ? input.start_date : null;
  const startTime = unit === "hour" && input.start_time && HM.test(input.start_time) ? input.start_time.slice(0, 5) : null;

  // 내용도 설명도 없는 빈 줄은 빼고 저장, 설명만 있고 작업 내용이 빈 줄은 알려 줌(적은 걸 모르고 버리지 않게)
  const kept = (input.steps ?? []).filter((s) => String(s.content ?? "").trim() || String(s.detail ?? "").trim());
  const missing = kept.map((s, i) => (String(s.content ?? "").trim() ? null : i + 1)).filter((n): n is number => n !== null);
  if (missing.length) return { error: `${missing.join(", ")}번 단계의 작업 내용을 입력해주세요.` };
  if (kept.some((s) => !isUuid(String(s.id ?? "")))) return { error: "잘못된 단계가 있습니다. 화면을 새로 고친 뒤 다시 시도해주세요." };
  const steps = kept.map((s, i) => ({
    id: s.id,
    sequence_id: input.id,
    sort_order: i + 1,
    content: String(s.content).trim(),
    detail: String(s.detail ?? "").trim() || null,
    duration: normalizeAmount(Number(s.duration), unit, "duration"),
    overlap: i === 0 ? 0 : normalizeAmount(Number(s.overlap), unit, "overlap"),
    done: Boolean(s.done),
    done_date: s.done && s.done_date && YMD.test(s.done_date) ? s.done_date : null,
  }));
  const stepIds = steps.map((s) => s.id);

  const supabase = await createClient();
  // 다른 순서표의 단계 id가 섞여 오면(화면 오류) 그 단계를 이 순서표로 옮기지 않게 막음
  if (stepIds.length) {
    const { data: existing, error } = await supabase.from("work_sequence_steps").select("id, sequence_id").in("id", stepIds);
    if (error) return { error: dbError(error) };
    if ((existing ?? []).some((r) => r.sequence_id !== input.id)) {
      return { error: "잘못된 단계가 있습니다. 화면을 새로 고친 뒤 다시 시도해주세요." };
    }
  }

  const { error: headError } = await supabase.from("work_sequences").upsert(
    {
      id: input.id,
      project_id: projectId,
      title,
      unit,
      start_date: startDate,
      start_time: startTime,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (headError) return { error: dbError(headError) };

  if (steps.length) {
    const { error } = await supabase.from("work_sequence_steps").upsert(steps, { onConflict: "id" });
    if (error) return { error: dbError(error) };
  }
  // 화면에서 지운 단계 정리(넣고 고친 뒤에 지움 — 중간에 실패해도 적은 단계가 사라지지 않게)
  let removal = supabase.from("work_sequence_steps").delete().eq("sequence_id", input.id);
  if (stepIds.length) removal = removal.not("id", "in", `(${stepIds.join(",")})`);
  const { error: removeError } = await removal;
  if (removeError) return { error: dbError(removeError) };

  revalidatePath("/quality-construction");
  return {};
}

export async function deleteWorkSequence(id: string): Promise<{ error?: string }> {
  if (!isUuid(String(id ?? ""))) return { error: "잘못된 순서표입니다." };
  const supabase = await createClient();
  // 단계는 같이 지워짐(098 SQL on delete cascade)
  const { error } = await supabase.from("work_sequences").delete().eq("id", id);
  if (error) return { error: dbError(error) };
  revalidatePath("/quality-construction");
  return {};
}
