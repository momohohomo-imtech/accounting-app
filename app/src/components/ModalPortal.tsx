"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// body의 진짜 직계 자식으로 렌더링해서, 인쇄 시 "이 팝업만 남기고 나머지는 숨기기"를
// 복잡한 visibility 트릭 없이 body > *:not(#app-modal-portal) 한 줄로 확실하게 처리할 수 있게 한다.
export function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(<div id="app-modal-portal">{children}</div>, document.body);
}
