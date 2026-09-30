"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// 예전 방식 출장일지(business_trip_logs) — 새로 쓰기·고치기는 없어지고(작업일지 팝업의 "출장" 체크 + TripLogPopup으로
// 바뀜) 보기 화면의 삭제만 남음.
export async function deleteBusinessTripLog(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("business_trip_logs").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/worklogs");
}
