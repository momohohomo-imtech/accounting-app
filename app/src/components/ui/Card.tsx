import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";

const paddingClass = {
  none: "",
  md: "p-5",
  lg: "p-8",
} as const;

export function Card({
  className,
  padding = "md",
  ...props
}: ComponentProps<"div"> & { padding?: keyof typeof paddingClass }) {
  return <div className={cx("rounded-2xl border border-slate-200 bg-white shadow-sm", paddingClass[padding], className)} {...props} />;
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("mb-3 flex items-center justify-between gap-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={cx("font-semibold text-slate-900", className)} {...props} />;
}
