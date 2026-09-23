import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/cx";

// 긴 표용: 표 영역 안에서 세로로 스크롤되고 머리글은 위에 붙어 있음. 표가 화면보다 넓어 가로 스크롤도
// 필요해서, 페이지 스크롤 기준 sticky는 쓸 수 없음(가로 스크롤 상자 안에서는 sticky가 안 먹음).
// 인쇄할 때는 높이 제한과 고정을 풀어 전체가 찍히게 한다.
export const stickyHeadWrapClass =
  "max-h-[calc(100vh-10rem)] overflow-auto print:max-h-none print:overflow-visible [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-white [&_thead_th]:pt-2 [&_thead_th]:shadow-[inset_0_-1px_0_var(--color-slate-200)] print:[&_thead_th]:static print:[&_thead_th]:shadow-none";

export function Table({ className, stickyHeader, ...props }: ComponentProps<"table"> & { stickyHeader?: boolean }) {
  return (
    <div className={stickyHeader ? stickyHeadWrapClass : "overflow-x-auto print:overflow-visible"}>
      <table className={cx("w-full text-sm", className)} {...props} />
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-slate-200 text-left text-slate-500">{children}</tr>
    </thead>
  );
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return <th className={cx("whitespace-nowrap pb-2 font-medium", className)} {...props} />;
}

export function Tr({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cx("border-b border-slate-100 transition-colors hover:bg-blue-100 last:border-0", className)} {...props} />;
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cx("py-2 text-slate-700", className)} {...props} />;
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-8 text-center text-slate-400">
        {children}
      </td>
    </tr>
  );
}
