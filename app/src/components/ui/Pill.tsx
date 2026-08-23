import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export function Pill({
  href,
  active,
  size = "sm",
  children,
}: {
  href: string;
  active: boolean;
  size?: "sm" | "xs";
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30",
        size === "sm" ? "px-3 py-1.5 text-sm" : "px-3 py-1.5 text-xs",
        active ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-100"
      )}
    >
      {children}
    </Link>
  );
}
