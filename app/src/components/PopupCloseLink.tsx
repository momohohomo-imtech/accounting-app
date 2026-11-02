"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { closePopup } from "@/lib/popupNavigation";

/**
 * 주소로 연 팝업의 "닫기" 링크 — 뒤로가기 기록을 쌓지 않고 닫음(lib/popupNavigation.ts, 예전 `<Link href={closeHref}>`는
 * 닫을 때마다 기록이 쌓여 뒤로가기로 팝업이 다시 열렸음). Ctrl·가운데 클릭(새 탭)은 보통 링크처럼.
 */
export function PopupCloseLink({
  href,
  children,
  ...rest
}: { href: string } & Omit<ComponentProps<typeof Link>, "href" | "onClick">) {
  const router = useRouter();
  return (
    <Link
      href={href}
      scroll={false}
      {...rest}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        closePopup(router, href);
      }}
    >
      {children}
    </Link>
  );
}
