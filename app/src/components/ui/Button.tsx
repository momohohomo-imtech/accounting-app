import Link from "next/link";
import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50";

const variantClass = {
  primary: "bg-slate-900 font-semibold text-white hover:bg-slate-700",
  secondary: "border border-slate-300 text-slate-600 hover:bg-slate-100",
  danger: "border border-red-200 text-red-600 hover:bg-red-50",
  ghost: "text-slate-500 hover:text-slate-800",
} as const;

const sizeClass = {
  xs: "px-2.5 py-1 text-xs",
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
} as const;

export type ButtonVariant = keyof typeof variantClass;
export type ButtonSize = keyof typeof sizeClass;

type ButtonOwnProps = { variant?: ButtonVariant; size?: ButtonSize };

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & ButtonOwnProps) {
  return <button className={cx(base, variantClass[variant], sizeClass[size], className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & ButtonOwnProps) {
  return <Link className={cx(base, variantClass[variant], sizeClass[size], className)} {...props} />;
}
