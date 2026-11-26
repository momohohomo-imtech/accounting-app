import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// API 주소(/api/ocr·/api/payroll-ocr·/api/transactions-excel) 안에서 한 번 더 하는 권한 확인 — 관리자·직원만(11/26 보안 점검).
// 앞단(proxy·미들웨어)이 로그인 안 함·세무사·조회 전용을 이미 막지만, 그 설정이 바뀌거나 빠져도 이 주소들이 바깥에 열리지 않게
// (인식 주소는 부를 때마다 제미나이 요금이 나감). 문제없으면 null, 막아야 하면 돌려줄 응답.
export async function requireWriterForApi(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { data } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (data?.role !== "admin" && data?.role !== "staff") {
    return NextResponse.json({ error: "이 기능을 쓸 권한이 없습니다." }, { status: 403 });
  }
  return null;
}
