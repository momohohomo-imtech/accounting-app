import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

const variantClass = {
  blue: "bg-blue-50 text-blue-700",
  orange: "bg-orange-50 text-orange-700",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  slate: "bg-slate-100 text-slate-600",
  green: "bg-green-600 text-white",
} as const;

export function Badge({
  variant = "slate",
  className,
  children,
}: {
  variant?: keyof typeof variantClass;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cx("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", variantClass[variant], className)}>
      {children}
    </span>
  );
}
