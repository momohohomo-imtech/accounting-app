import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { SidebarNav, MobileNav } from "@/components/AppNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-60 shrink-0 bg-slate-900 md:flex md:flex-col">
        <div className="border-b border-slate-800 px-5 py-5">
          <p className="font-mono text-[11px] tracking-widest text-slate-500">FIELD OPS · v0.1</p>
          <p className="mt-1 text-base font-bold text-white">현장관리</p>
        </div>
        <SidebarNav />
        <form action={signOut} className="border-t border-slate-800 p-3">
          <p className="truncate px-3 pb-2 text-xs text-slate-500">{user?.email}</p>
          <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white">
            로그아웃
          </button>
        </form>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3 md:hidden">
          <p className="text-sm font-bold text-white">현장관리 시스템</p>
        </header>
        <MobileNav />
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
