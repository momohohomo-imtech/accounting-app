"use client";

import { useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";

export function CollapsibleSection({
  title,
  headerExtra,
  defaultOpen = false,
  className,
  children,
}: {
  title: ReactNode;
  headerExtra?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cx("rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 text-left font-semibold text-slate-900 transition-colors hover:text-slate-600"
        >
          <span className="text-xs text-slate-400 print:hidden">{open ? "▼" : "▶"}</span>
          {title}
        </button>
        {headerExtra}
      </div>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}
