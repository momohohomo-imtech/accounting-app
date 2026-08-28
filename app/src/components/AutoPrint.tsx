"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 인쇄 전용 URL(?printXxx=1)로 들어오면 자동으로 인쇄창을 띄운다.
// 인쇄창이 닫히면(취소 포함) cleanupHref로 주소를 되돌려서, 그 상태에서
// 새로고침해도 인쇄창이 계속 다시 뜨지 않게 한다.
export function AutoPrint({ cleanupHref }: { cleanupHref?: string }) {
  const router = useRouter();

  useEffect(() => {
    function cleanup() {
      if (cleanupHref) router.replace(cleanupHref);
      window.removeEventListener("afterprint", cleanup);
    }
    window.addEventListener("afterprint", cleanup);
    window.print();
    return () => window.removeEventListener("afterprint", cleanup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
