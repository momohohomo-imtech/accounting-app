import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";

const NAV = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/transactions", label: "매입매출·외상" },
  { href: "/projects", label: "프로젝트·현장" },
  { href: "/worklogs", label: "작업일지" },
  { href: "/employees", label: "직원관리" },
  { href: "/daily-workers", label: "일용직 관리" },
  { href: "/bank", label: "은행 거래내역" },
  { href: "/reports", label: "보고서" },
  { href: "/backups", label: "시스템·백업" },
];

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
        <nav className="flex flex-1 flex-col gap-0.5 p-3">
          {NAV.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <span className="font-mono text-xs text-slate-600 group-hover:text-slate-400">
                {String(i).padStart(2, "0")}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>
        <form action={signOut} className="border-t border-slate-800 p-3">
          <p className="truncate px-3 pb-2 text-xs text-slate-500">{user?.email}</p>
          <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-800 hover:text-white">
            로그아웃
          </button>
        </form>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3 md:hidden">
          <p className="text-sm font-bold text-white">현장관리 시스템</p>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-slate-800 bg-slate-900 px-2 py-2 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
