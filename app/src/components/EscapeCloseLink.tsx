"use client";

import { useRouter } from "next/navigation";
import { useEscapeKey } from "@/lib/useEscapeKey";

/** 서버 컴포넌트가 searchParams로 열어둔 팝업(URL 기반)을 ESC로 닫기 위한 보이지 않는 도우미. */
export function EscapeCloseLink({ href }: { href: string }) {
  const router = useRouter();
  useEscapeKey(true, () => router.push(href));
  return null;
}
