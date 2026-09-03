"use client";

import { useEffect, useRef } from "react";

// 인쇄 내용이 얼마나 되든(공구 1개든 142개든) 항상 1페이지 안에 들어가도록,
// 인쇄 직전에 실제 렌더링된 높이를 측정해서 필요한 만큼만 축소 배율을 적용함
// (엑셀의 "1페이지에 맞추기"와 같은 방식). 미리 픽셀 값을 계산해서 맞추는
// 것보다, 실제 브라우저 폰트 렌더링·여백 설정에 안전하게 대응함 — 이미
// 1페이지에 들어가면 축소하지 않음(글자 크기 그대로 유지).
export function usePrintFitToPage<T extends HTMLElement>(pageHeightMm = 270) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function beforePrint() {
      if (!el) return;
      el.style.transform = "";
      el.style.width = "";
      const pageHeightPx = (pageHeightMm / 25.4) * 96;
      const contentHeight = el.scrollHeight;
      if (contentHeight > pageHeightPx) {
        const scale = pageHeightPx / contentHeight;
        el.style.transformOrigin = "top left";
        el.style.transform = `scale(${scale})`;
        el.style.width = `${100 / scale}%`;
      }
    }
    function afterPrint() {
      if (!el) return;
      el.style.transform = "";
      el.style.width = "";
    }

    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => {
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
    };
  }, [pageHeightMm]);

  return ref;
}
