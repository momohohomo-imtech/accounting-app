"use client";

import { useEffect, useRef } from "react";

// 인쇄 내용이 얼마나 되든(공구 1개든 142개든) 항상 1페이지 안에 들어가도록,
// 인쇄 직전에 실제 렌더링된 높이를 측정해서 필요한 만큼만 축소 배율을 적용함
// (엑셀의 "1페이지에 맞추기"와 같은 방식). 미리 픽셀 값을 계산해서 맞추는
// 것보다, 실제 브라우저 폰트 렌더링·여백 설정에 안전하게 대응함 — 이미
// 1페이지에 들어가면 축소하지 않음(글자 크기 그대로 유지).
//
// CSS transform:scale()은 화면에는 작게 "보이기만" 할 뿐 인쇄 페이지 분할 계산은
// 축소 전 크기 그대로 이뤄져서, 내용이 넘치면 스케일과 무관하게 2페이지로
// 갈라지는 문제가 있었음. zoom은(transform과 달리) 실제 레이아웃 크기 자체를
// 줄여서 페이지 분할 계산에도 반영되므로 이 용도에 맞음(크롬/엣지 기준 — 이
// 앱은 실질적으로 그 환경에서만 씀).
export function usePrintFitToPage<T extends HTMLElement>(pageHeightMm = 270) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function beforePrint() {
      if (!el) return;
      el.style.removeProperty("zoom");
      const pageHeightPx = (pageHeightMm / 25.4) * 96;
      const contentHeight = el.scrollHeight;
      if (contentHeight > pageHeightPx) {
        const scale = pageHeightPx / contentHeight;
        el.style.setProperty("zoom", String(scale));
      }
    }
    function afterPrint() {
      if (!el) return;
      el.style.removeProperty("zoom");
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
