"use client";

import { useEffect, useRef, useState } from "react";
import { escapeStack } from "@/lib/escapeStack";

// 리스너는 창에 하나만 — 쌓인 팝업 중 맨 위 것 하나만 부름(escapeStack.ts).
function handleKeyDown(e: KeyboardEvent) {
  // 한글 입력 중(조합 중)의 ESC는 글자 조합을 끝내는 키 — 팝업은 닫지 않음. 다른 칸이 먼저 ESC를 썼으면(preventDefault) 그대로 둠.
  if (e.key !== "Escape" || e.isComposing || e.defaultPrevented) return;
  if (escapeStack.pressTop()) e.preventDefault();
}

let listening = false;
function syncListener() {
  const want = escapeStack.size() > 0;
  if (want === listening || typeof window === "undefined") return;
  if (want) window.addEventListener("keydown", handleKeyDown);
  else window.removeEventListener("keydown", handleKeyDown);
  listening = want;
}

/**
 * ESC 키를 누르면 onEscape를 호출 — active가 true인 동안만(팝업이 열려 있을 때만).
 * 팝업이 여러 겹이면 맨 위(나중에 열린) 팝업 하나만 닫힘(확인창 → 그 아래 팝업 순서) — 예전엔 열린 팝업이 한 번에 다 닫혔음.
 * 사용자 요청 11/1 "모든 팝업창은 esc누르면 닫게": 화면을 덮는 팝업·확인창은 전부 이 훅을 쓸 것.
 */
export function useEscapeKey(active: boolean, onEscape: () => void) {
  const handlerRef = useRef(onEscape);
  useEffect(() => {
    handlerRef.current = onEscape;
  });
  // 그린 순서 — 바깥 팝업과 안쪽 팝업이 같이 열리면 안쪽이 위(escapeStack 설명 참고).
  const [renderOrder] = useState(() => escapeStack.nextRenderOrder());
  useEffect(() => {
    if (!active) return;
    const remove = escapeStack.add(renderOrder, () => handlerRef.current());
    syncListener();
    return () => {
      remove();
      syncListener();
    };
  }, [active, renderOrder]);
}
