import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { toSessionCookie } from "./sessionCookie";

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
    const { data } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
    role = data?.role ?? null;
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
