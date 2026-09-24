import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { SidebarNav, MobileNav } from "@/components/AppNav";
import { IdleLogout } from "@/components/IdleLogout";
import { ConfirmProvider } from "@/components/ConfirmProvider";
import { GlobalPendingProvider } from "@/components/GlobalPendingProvider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("users").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const role = profile?.role ?? null;

  return (
    <ConfirmProvider>
    <GlobalPendingProvider>
    <div className="app-backdrop flex min-h-screen bg-slate-50">
      <IdleLogout />
      <aside className="brand-sidebar hidden w-60 shrink-0 bg-brand-navy md:sticky md:top-0 md:flex md:h-screen md:flex-col print:hidden">
        <div className="flex items-center gap-3 px-6 pb-2 pt-7">
          <Image src="/logo-icon.png" alt="" width={32} height={32} className="rounded-lg shadow-md shadow-black/30 ring-1 ring-white/10" />
          <div className="leading-tight">
            <p className="text-[15px] font-semibold tracking-tight text-white">IM테크</p>
            <p className="mt-0.5 text-xs text-white/50">회계 관리 시스템</p>
          </div>
        </div>
        <SidebarNav role={role} />
        <form action={signOut} className="border-t border-white/[0.08] px-6 py-4">
          <p className="flex items-center gap-1.5 truncate text-xs text-white/50">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-green shadow-[0_0_0_3px_rgb(14_159_110/0.2)]" aria-hidden />
            <span className="truncate">{user?.email}</span>
          </p>
          <button className="mt-1 text-xs text-white/60 transition-colors hover:text-white">로그아웃</button>
        </form>
      </aside>

      {/* min-w-0: 없으면 넓은 표(min-w-[600px] 등)가 본문 폭을 밀어 휴대폰에서 페이지 전체가 옆으로
          늘어나고, 하단 탭이 화면 밖으로 밀려남. 넓은 표는 각자의 가로 스크롤 안에서만 넘치게 한다.
          overflow-x-clip: 그래도 어딘가 넘치는 게 있으면 페이지 전체가 옆으로 늘어나는 대신 잘리게(최후 방어). */}
      <div className="flex min-w-0 flex-1 flex-col overflow-x-clip">
        <header className="brand-topbar flex items-center justify-between gap-2 bg-brand-navy px-4 py-3 md:hidden print:hidden">
          <div className="flex items-center gap-2">
            <Image src="/logo-icon.png" alt="" width={22} height={22} className="rounded-md" />
            <p className="text-sm font-bold text-white">IM테크 회계 관리 시스템</p>
          </div>
          <form action={signOut}>
            <button className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white">
              로그아웃
            </button>
          </form>
        </header>
        {/* pb-24: 휴대폰 하단 탭에 내용이 가리지 않게. 인쇄 폭(A4 ≈ 718px)도 md 미만이라 인쇄 땐 원래 여백으로. */}
        {role === "viewer" && (
          <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-800 print:hidden">
            조회 전용 계정이에요 — 보기만 가능하고 저장·수정·삭제는 되지 않아요.
          </p>
        )}
        <main className="flex-1 p-4 pb-24 md:p-8 print:pb-4">{children}</main>
        <MobileNav role={role} />
      </div>
    </div>
    </GlobalPendingProvider>
    </ConfirmProvider>
  );
}
