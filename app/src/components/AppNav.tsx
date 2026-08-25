"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";

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

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-0.5 p-3">
      {NAV.map((item, i) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
              active ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
            )}
          >
            <span
              className={cx(
                "font-mono text-xs transition-colors",
                active ? "text-slate-300" : "text-slate-600 group-hover:text-slate-400"
              )}
            >
              {String(i).padStart(2, "0")}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-slate-800 bg-slate-900 px-2 py-2 md:hidden print:hidden">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "shrink-0 rounded-lg px-3 py-1.5 text-xs transition-colors",
              active ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
