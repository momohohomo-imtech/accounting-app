"use client";

import { useEffect } from "react";

/** ESC 키를 누르면 onEscape를 호출 — active가 true인 동안만 리스너를 붙임(팝업 열려있을 때만). */
export function useEscapeKey(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onEscape();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, onEscape]);
}
