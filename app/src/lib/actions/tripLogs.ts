"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { WORK_TYPE_OPTIONS } from "@/lib/businessTrip";
import { inputToTripDayFields, type TripDayInput } from "@/lib/tripLog";

// 출장일지(새 방식, 090) 수정 — 머리 정보(작업구분·비고)와 날짜 줄(인원·장비). 날짜 줄은 작업일지 팝업의 "출장"
// 체크로만 생기고, 여기서 뺀 날짜는 작업일지의 출장 체크도 풀림(체크 여부 = trip_log_days에 줄이 있는지).
export async function saveTripLog(input: {
  projectId: string;
  workTypes: string[];
  note: string;
  days: { id: string; input: TripDayInput }[];
  removedDayIds: string[];
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const head = await supabase.from("trip_logs").upsert({
    project_id: input.projectId,
    work_types: input.workTypes.filter((t) => WORK_TYPE_OPTIONS.includes(t)),
    note: input.note.trim() || null,
    updated_at: now,
  });
  if (head.error) return { error: head.error.message };

  const results = await Promise.all(
    input.days.map((d) =>
      supabase
        .from("trip_log_days")
        .update({ ...inputToTripDayFields(d.input), updated_at: now })
        .eq("id", d.id)
        .eq("project_id", input.projectId)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };

  if (input.removedDayIds.length > 0) {
    const rm = await supabase
      .from("trip_log_days")
      .delete()
      .in("id", input.removedDayIds)
      .eq("project_id", input.projectId);
    if (rm.error) return { error: rm.error.message };
  }

  revalidatePath("/worklogs");
  return {};
}
