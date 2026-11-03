"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/fileUpload";
import { normalizeAmount, parseTeams, teamNameProblem, type SequenceUnit, type WorkTeam } from "@/lib/workSequence";

// 공사 작업 순서표 저장·삭제(098·099·100 SQL, 사용자 요청 11/2). 순서표 한 장(머리 + 단계 전부)을 한 번에 저장 — 단계 id는 화면에서 미리
// 만든 것을 그대로 써서, 저장 도중 실패해 다시 눌러도 단계가 두 번 들어가지 않음. 날짜는 저장하지 않음(lib/workSequence.ts가 계산).

export type WorkSequenceStepInput = {
  id: string;
  content: string;
  detail: string;
  duration: number;
  overlap: number;
  done: boolean;
  done_date: string | null;
  /** 앞 작업으로 고른 단계(같은 순서표). 없으면 바로 앞 단계 — 099 SQL */
  after_step_id: string | null;
  /** 순서표 시작에 같이 시작("처음부터") — 099 SQL */
  after_start: boolean;
  /** 맡은 팀(이 순서표 팀 목록의 id, 없으면 팀 미정) — 100 SQL */
  team_id?: string | null;
};

export type WorkSequenceInput = {
  id: string;
  project_id: string;
  title: string;
  unit: SequenceUnit;
  start_date: string | null;
  start_time: string | null;
  steps: WorkSequenceStepInput[];
  /** 099 SQL을 실행해서 앞 작업 칸이 있음(화면이 확인해서 넘김) — 없으면 앞 작업은 저장하지 않음 */
  with_dependency?: boolean;
  /** 이 순서표의 팀 목록(이름·색) — 100 SQL */
  teams?: WorkTeam[];
  /** 100 SQL을 실행해서 팀 칸이 있음(화면이 확인해서 넘김) — 없으면 팀은 저장하지 않음 */
  with_teams?: boolean;
  /** 순서표 메모(작업 지시사항·전달사항 — 인쇄 때 프로젝트 이름 아래) — 103 SQL */
  memo?: string;
  /** 103 SQL을 실행해서 메모 칸이 있음(화면이 확인해서 넘김) — 없으면 메모는 저장하지 않음 */
  with_memo?: boolean;
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^\d{2}:\d{2}(:\d{2})?$/;
const MISSING_TABLE = new Set(["PGRST205", "42P01"]);
const MISSING_COLUMN = new Set(["PGRST204", "42703"]);

function dbError(error: { code?: string; message: string }) {
  if (MISSING_TABLE.has(error.code ?? "")) {
    return "공사 작업 순서 표가 아직 없습니다 — Supabase SQL Editor에서 098 SQL을 먼저 실행해주세요.";
  }
  if (MISSING_COLUMN.has(error.code ?? "")) {
    if (/memo/.test(error.message)) return "메모 칸이 아직 없습니다 — Supabase SQL Editor에서 103 SQL을 실행해주세요.";
    return /team/.test(error.message)
      ? "팀 칸이 아직 없습니다 — Supabase SQL Editor에서 100 SQL을 실행해주세요."
      : "앞 작업 칸이 아직 없습니다 — Supabase SQL Editor에서 099 SQL을 실행해주세요.";
  }
  return error.message;
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
  const keptIds = new Set(kept.map((s) => s.id));
  // 팀 목록 정리(이름·색·같은 id) — 단계의 팀은 이 목록에 있는 팀만(지운 팀을 가리키면 팀 미정). 이름이 비거나 같은 팀은 저장 전에
  // 막음(조용히 빼면 그 팀 단계가 팀 미정으로 바뀌어 버림)
  if (input.with_teams) {
    const rawTeams = Array.isArray(input.teams) ? input.teams : [];
    const problem = teamNameProblem(rawTeams.map((t) => ({ name: t?.name })));
    if (problem) return { error: problem };
  }
  const teams = input.with_teams ? parseTeams(input.teams) : [];
  const teamIds = new Set(teams.map((t) => t.id));
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
    // 앞 작업은 이 순서표에 남는 다른 단계만(빈 줄로 빠지거나 지운 단계를 가리키면 빈칸 = 바로 앞 단계)
    ...(input.with_dependency
      ? {
          after_step_id:
            !s.after_start && s.after_step_id && s.after_step_id !== s.id && keptIds.has(s.after_step_id) ? s.after_step_id : null,
          after_start: i > 0 && Boolean(s.after_start),
        }
      : {}),
    ...(input.with_teams ? { team_id: s.team_id && teamIds.has(s.team_id) ? s.team_id : null } : {}),
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
      ...(input.with_teams ? { teams } : {}),
      // 메모는 줄바꿈 그대로, 앞뒤 빈칸만 정리(비우면 빈칸)
      ...(input.with_memo ? { memo: String(input.memo ?? "").trim() || null } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (headError) return { error: dbError(headError) };

  if (steps.length) {
    // 앞 작업(같은 줄 묶음 안의 다른 단계를 가리킴)도 한 번에 — DB가 묶음을 다 넣은 뒤에 연결을 확인함
    const { error } = await supabase.from("work_sequence_steps").upsert(steps, { onConflict: "id" });
    if (error) return { error: dbError(error) };
  }
  // 화면에서 지운 단계 정리(넣고 고친 뒤에 지움 — 중간에 실패해도 적은 단계가 사라지지 않게). 지운 단계를 앞 작업으로 가리키던
  // 단계는 DB가 빈칸으로(099 SQL on delete set null).
  let removal = supabase.from("work_sequence_steps").delete().eq("sequence_id", input.id);
  if (stepIds.length) removal = removal.not("id", "in", `(${stepIds.join(",")})`);
  const { error: removeError } = await removal;
  if (removeError) return { error: dbError(removeError) };

  revalidatePath("/quality-construction");
  return {};
}

// 완료 체크·완료일만 바로 저장(사용자 요청 11/2 "현장에서 완료 체크만 바로") — 화면은 실패하면 체크를 원래대로 되돌림.
export async function setWorkSequenceStepDone(input: {
  sequence_id: string;
  id: string;
  done: boolean;
  done_date: string | null;
}): Promise<{ error?: string }> {
  if (!isUuid(String(input.sequence_id ?? "")) || !isUuid(String(input.id ?? ""))) return { error: "잘못된 단계입니다." };
  const done = Boolean(input.done);
  const doneDate = done && input.done_date && YMD.test(input.done_date) ? input.done_date : null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_sequence_steps")
    .update({ done, done_date: doneDate })
    .eq("id", input.id)
    .eq("sequence_id", input.sequence_id)
    .select("id");
  if (error) return { error: dbError(error) };
  // 바뀐 줄이 없으면(조회 전용 계정이거나 다른 곳에서 지운 단계) 된 것처럼 두지 않음
  if (!data || data.length === 0) return { error: "저장되지 않았습니다(권한이 없거나 이미 지워진 단계입니다). 화면을 새로 고쳐 주세요." };
  await supabase.from("work_sequences").update({ updated_at: new Date().toISOString() }).eq("id", input.sequence_id);
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
