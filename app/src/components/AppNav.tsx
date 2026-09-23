"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";
import { useEscapeKey } from "@/lib/useEscapeKey";

type NavItem = { href: string; label: string; short?: string };
type NavGroup = { title: string | null; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  { title: null, items: [{ href: "/dashboard", label: "대시보드" }] },
  {
    title: "회계",
    items: [
      { href: "/transactions", label: "매입매출·외상", short: "매입매출" },
      { href: "/bank", label: "은행 거래내역" },
      { href: "/reports", label: "보고서" },
    ],
  },
  {
    title: "현장",
    items: [
      { href: "/projects", label: "프로젝트·현장", short: "프로젝트" },
      { href: "/quality-construction", label: "공사 관리" },
      { href: "/worklogs", label: "작업일지" },
    ],
  },
  {
    title: "인력",
    items: [
      { href: "/employees", label: "직원관리" },
      { href: "/daily-workers", label: "일용직 관리" },
    ],
  },
  {
    title: "도구",
    items: [
      { href: "/memos", label: "메모장" },
      { href: "/calculators", label: "계산기" },
      { href: "/backups", label: "백업" },
    ],
  },
];

// 휴대폰 하단 탭에 바로 보이는 메뉴 — 나머지는 "더보기"에서.
const MOBILE_TAB_HREFS = ["/dashboard", "/transactions", "/projects", "/worklogs"];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function groupsFor(role: string | null): NavGroup[] {
  if (role !== "tax_agent") return NAV_GROUPS;
  const allowed = new Set(["/dashboard", "/transactions"]);
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => allowed.has(i.href)) })).filter(
    (g) => g.items.length > 0
  );
}

function GroupedLinks({
  groups,
  pathname,
  onNavigate,
  tone,
}: {
  groups: NavGroup[];
  pathname: string;
  onNavigate?: () => void;
  tone: "dark" | "light";
}) {
  return (
    <>
      {groups.map((group, gi) => (
        <div key={group.title ?? "top"} className={cx(gi > 0 && "mt-6")}>
          {group.title && (
            <p
              className={cx(
                "mb-1.5 px-3 text-[11px] font-medium tracking-[0.12em]",
                tone === "dark" ? "text-slate-500" : "text-slate-400"
              )}
            >
              {group.title}
            </p>
          )}
          <div className="flex flex-col gap-px">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "relative rounded-md px-3 py-2 text-sm transition-colors",
                    tone === "dark"
                      ? active
                        ? "bg-white/[0.08] font-medium text-white"
                        : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
                      : active
                        ? "bg-slate-100 font-medium text-slate-900"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  {active && (
                    <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand" aria-hidden />
                  )}
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

export function SidebarNav({ role }: { role: string | null }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-5">
      <GroupedLinks groups={groupsFor(role)} pathname={pathname} tone="dark" />
    </nav>
  );
}

export function MobileNav({ role }: { role: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEscapeKey(open, () => setOpen(false));

  const groups = groupsFor(role);
  const all = groups.flatMap((g) => g.items);
  const tabs = all.filter((i) => MOBILE_TAB_HREFS.includes(i.href));
  const hasMore = all.length > tabs.length;
  const moreActive = !tabs.some((t) => isActive(pathname, t.href));

  const tabClass = (active: boolean) =>
    cx(
      "relative flex flex-1 items-center justify-center py-3.5 text-[13px] transition-colors",
      active ? "font-semibold text-white" : "text-slate-400 active:text-slate-200"
    );
  const indicator = <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-brand" aria-hidden />;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden print:hidden" role="dialog" aria-modal="true" aria-label="전체 메뉴">
          <button
            type="button"
            aria-label="메뉴 닫기"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 shadow-xl">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" aria-hidden />
            <GroupedLinks groups={groups} pathname={pathname} tone="light" onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-800 bg-slate-900 pb-[env(safe-area-inset-bottom)] md:hidden print:hidden">
        {tabs.map((t) => {
          const active = isActive(pathname, t.href);
          return (
            <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
              {active && indicator}
              {t.short ?? t.label}
            </Link>
          );
        })}
        {hasMore && (
          <button type="button" onClick={() => setOpen(true)} className={tabClass(moreActive)} aria-expanded={open}>
            {moreActive && indicator}
            더보기
          </button>
        )}
      </nav>
    </>
  );
}
