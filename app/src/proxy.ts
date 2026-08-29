import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // api/cron/*는 세션 쿠키 없이 Vercel Cron이 직접 호출하므로 제외 — 각 라우트가 자체
  // CRON_SECRET 검사로 인증한다. 여기서 제외하지 않으면 로그인 세션이 없어 /login으로
  // 리다이렉트되어 크론이 실제로 동작하지 않는다.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
