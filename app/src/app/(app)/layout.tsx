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
    <div className="flex min-h-screen bg-slate-50">
      <IdleLogout />
      <aside className="hidden w-60 shrink-0 bg-slate-900 md:flex md:flex-col">
        <div className="flex items-center gap-2.5 border-b border-slate-800 px-5 py-5">
          <Image src="/logo-icon.png" alt="" width={30} height={30} className="rounded-md" />
          <div>
            <p className="font-mono text-[11px] tracking-widest text-slate-500">FIELD OPS · v0.1</p>
            <p className="mt-0.5 text-base font-bold text-white">현장관리</p>
          </div>
        </div>
        <SidebarNav role={role} />
        <form action={signOut} className="border-t border-slate-800 p-3">
          <p className="truncate px-3 pb-2 text-xs text-slate-500">{user?.email}</p>
          <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white">
            로그아웃
          </button>
        </form>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-4 py-3 md:hidden print:hidden">
          <div className="flex items-center gap-2">
            <Image src="/logo-icon.png" alt="" width={22} height={22} className="rounded-md" />
            <p className="text-sm font-bold text-white">현장관리 시스템</p>
          </div>
          <form action={signOut}>
            <button className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-white">
              로그아웃
            </button>
          </form>
        </header>
        <MobileNav role={role} />
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
    </GlobalPendingProvider>
    </ConfirmProvider>
  );
}
