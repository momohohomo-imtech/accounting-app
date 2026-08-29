import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { toSessionCookie } from "./sessionCookie";
import { createAdminClient } from "./admin";
import { TAX_AGENT_SUSPEND_DURATION } from "@/lib/taxAgentSuspend";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, toSessionCookie(options))
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith("/login");

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  let role: string | null = null;
  if (user) {
    const { data } = await supabase.from("users").select("role, resuspend_at").eq("id", user.id).maybeSingle();
    role = data?.role ?? null;

    // 세무사 계정을 "N시간만 열어주고" 해제했는데 그 시각이 지났으면, 지금 이 요청에서 바로
    // 다시 정지시키고 세션을 끊는다 (관리자가 관리 화면을 다시 열 때까지 기다리지 않아도 됨).
    if (role === "tax_agent" && data?.resuspend_at && new Date(data.resuspend_at).getTime() <= Date.now()) {
      try {
        const admin = createAdminClient();
        await admin.auth.admin.updateUserById(user.id, { ban_duration: TAX_AGENT_SUSPEND_DURATION });
        await admin.from("users").update({ resuspend_at: null }).eq("id", user.id);
      } catch {
        // SUPABASE_SERVICE_ROLE_KEY 미설정 등으로 실패해도 아래에서 세션은 끊는다.
      }
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }
  const homePath = role === "tax_agent" ? "/transactions" : "/dashboard";

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = homePath;
    return NextResponse.redirect(url);
  }

  // tax_agent(세무사 사무실 계정)는 매입매출·외상 화면만 볼 수 있음 — 그 외 경로는 강제 이동.
  if (user && role === "tax_agent" && !request.nextUrl.pathname.startsWith("/transactions")) {
    const url = request.nextUrl.clone();
    url.pathname = "/transactions";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
