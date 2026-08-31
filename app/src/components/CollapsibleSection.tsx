"use client";

import { useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";

export function CollapsibleSection({
  title,
  headerExtra,
  defaultOpen = false,
  /** 접혀 있어도 내용을 DOM에서 지우지 않고 화면에서만 숨김 — 인쇄는 접힘 상태와 무관하게 항상 전체 내용 그대로 나옴. */
  printAlways = false,
  /** 카드 테두리/배경 없이 제목 줄 + 내용만 — 이미 자기 카드 스타일이 있는 컴포넌트를 감쌀 때. */
  bare = false,
  className,
  children,
}: {
  title: ReactNode;
  headerExtra?: ReactNode;
  defaultOpen?: boolean;
  printAlways?: boolean;
  bare?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cx(bare ? "" : "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", className)}>
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
      {printAlways ? (
        <div className={cx(bare ? "" : "mt-3", !open && "hidden print:block")}>{children}</div>
      ) : (
        open && <div className={bare ? "" : "mt-3"}>{children}</div>
      )}
    </div>
  );
}
