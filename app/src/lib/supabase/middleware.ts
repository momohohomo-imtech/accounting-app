import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { toSessionCookie } from "./sessionCookie";
import { createAdminClient } from "./admin";
import { TAX_AGENT_SUSPEND_DURATION } from "@/lib/taxAgentSuspend";

// 인증 확인마다 Supabase에 네트워크 왕복이 있어서(페이지 이동/새로고침마다 매번),
// 그 요청 하나가 응답 없이 멈추면 이 미들웨어를 거치는 전체 앱이 같이 멈춰버림 —
// 실제로 겪은 증상(클릭도 새로고침도 전혀 반응 없음)의 원인으로 보임. 그렇다고
// 타임아웃 시 "일단 통과"시키면 보안이 뚫리므로, 타임아웃되면 항상 로그인 화면으로
// 돌려보내는 쪽(fail closed)으로만 처리 — 검증 안 된 요청을 통과시키는 일은 없음.
const AUTH_CHECK_TIMEOUT_MS = 8000;

class AuthCheckTimeoutError extends Error {}

function withTimeout<T>(promise: PromiseLike<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new AuthCheckTimeoutError(label)), AUTH_CHECK_TIMEOUT_MS);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function redirectToLoginOnTimeout(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("error", "인증 서버 응답이 지연되어 로그인 화면으로 돌아왔습니다. 다시 로그인해주세요.");
  return NextResponse.redirect(url);
}

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

  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;
  try {
    const {
      data: { user: fetchedUser },
    } = await withTimeout(supabase.auth.getUser(), "auth.getUser");
    user = fetchedUser;
  } catch (err) {
    if (err instanceof AuthCheckTimeoutError) return redirectToLoginOnTimeout(request);
    throw err;
  }

  const isAuthRoute = request.nextUrl.pathname.startsWith("/login");

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  let role: string | null = null;
  if (user) {
    let roleRow: { role: string | null; resuspend_at: string | null } | null = null;
    try {
      const { data } = await withTimeout(
        supabase.from("users").select("role, resuspend_at").eq("id", user.id).maybeSingle(),
        "users.select(role)"
      );
      roleRow = data;
    } catch (err) {
      if (err instanceof AuthCheckTimeoutError) return redirectToLoginOnTimeout(request);
      throw err;
    }
    role = roleRow?.role ?? null;

    // 세무사 계정을 "N시간만 열어주고" 해제했는데 그 시각이 지났으면, 지금 이 요청에서 바로
    // 다시 정지시키고 세션을 끊는다 (관리자가 관리 화면을 다시 열 때까지 기다리지 않아도 됨).
    if (role === "tax_agent" && roleRow?.resuspend_at && new Date(roleRow.resuspend_at).getTime() <= Date.now()) {
      try {
        const admin = createAdminClient();
        await withTimeout(
          admin.auth.admin.updateUserById(user.id, { ban_duration: TAX_AGENT_SUSPEND_DURATION }),
          "admin.updateUserById"
        );
        await withTimeout(admin.from("users").update({ resuspend_at: null }).eq("id", user.id), "users.update(resuspend_at)");
      } catch {
        // SUPABASE_SERVICE_ROLE_KEY 미설정·타임아웃 등으로 실패해도 아래에서 세션은 끊는다.
      }
      try {
        await withTimeout(supabase.auth.signOut(), "auth.signOut");
      } catch {
        // signOut이 안 되더라도 로그인 화면으로는 보낸다 — 세션 쿠키는 다음 요청에서 다시 검증됨.
      }
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

  // tax_agent(세무사 사무실 계정)는 매입매출·외상 화면 + 대시보드(전반적인 수익현황)만 볼 수
  // 있음 — 그 외 경로는 강제 이동.
  if (
    user &&
    role === "tax_agent" &&
    !request.nextUrl.pathname.startsWith("/transactions") &&
    !request.nextUrl.pathname.startsWith("/dashboard")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/transactions";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
