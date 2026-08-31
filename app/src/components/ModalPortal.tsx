"use client";

import { createPortal } from "react-dom";
import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

// body의 진짜 직계 자식으로 렌더링해서, 인쇄 시 "이 팝업만 남기고 나머지는 숨기기"를
// 복잡한 visibility 트릭 없이 body > *:not(#app-modal-portal) 한 줄로 확실하게 처리할 수 있게 한다.
// 서버에서는 false, 클라이언트 하이드레이션 후에는 true — useEffect+setState 없이
// useSyncExternalStore로 처리해서 렌더 중 불필요한 재렌더링 경고 없이 안전하게 구현.
export function ModalPortal({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
  if (!mounted) return null;
  return createPortal(<div id="app-modal-portal">{children}</div>, document.body);
}
