"use client";

import { useState } from "react";
import type { ReactNode } from "react";

export function DetailToggle({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
      >
        {label}
        <span className="text-[10px]">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="mt-1 space-y-1">{children}</div>}
    </div>
  );
}
