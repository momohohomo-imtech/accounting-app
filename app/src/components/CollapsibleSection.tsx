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
  open: openProp,
  onOpenChange,
  children,
}: {
  title: ReactNode;
  headerExtra?: ReactNode;
  defaultOpen?: boolean;
  printAlways?: boolean;
  bare?: boolean;
  className?: string;
  /** 바깥에서 열림을 정할 때(선택) — 접힌 칸 머리 줄의 "+ 추가" 단추가 칸을 펼치며 입력칸을 열 때(계정 관리) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  const open = openProp ?? innerOpen;
  const toggle = () => {
    const next = !open;
    if (openProp === undefined) setInnerOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div className={cx(bare ? "" : "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={toggle}
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
