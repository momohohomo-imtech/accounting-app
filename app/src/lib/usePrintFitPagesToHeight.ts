"use client";

import { useEffect } from "react";

// usePrintFitToPage와 같은 방식(zoom으로 실측 높이에 맞춰 축소)이지만, ref 하나가
// 아니라 CSS 선택자로 찾은 "여러 개"의 요소 각각에 독립적으로 적용함 — 동희
// 반입반출증처럼 품목 수에 따라 페이지가 몇 장이 될지 모르는 출력에 씀(훅은 매
// 렌더마다 같은 순서로 호출돼야 하는데, 페이지 수가 가변적이라 페이지마다 훅을
// 따로 호출할 수 없어서 이렇게 selector 기반으로 우회함).
//
// 동희 반입반출증은 실제 스캔 원본처럼 여백 없이 꽉 차 보여야 하는데, 정확한
// 배율을 미리 계산하기보다("SCALE=2로 해봤더니 넘쳐서 표가 깨짐" — 실측 없이
// 추측한 값이라 발생한 문제) 일부러 큼직하게(SCALE) 렌더링해두고 이 훅이 매번
// 실측해서 페이지 높이에 딱 맞게 줄이게 함 — 넘칠 걱정 없이 항상 페이지를
// 꽉 채우는 배율이 자동으로 나옴.
export function usePrintFitPagesToHeight(selector: string, pageHeightMm: number) {
  useEffect(() => {
    function beforePrint() {
      const pageHeightPx = (pageHeightMm / 25.4) * 96;
      document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
        el.style.removeProperty("zoom");
        const contentHeight = el.scrollHeight;
        if (contentHeight > pageHeightPx) {
          el.style.setProperty("zoom", String(pageHeightPx / contentHeight));
        }
      });
    }
    function afterPrint() {
      document.querySelectorAll<HTMLElement>(selector).forEach((el) => el.style.removeProperty("zoom"));
    }

    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => {
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
    };
  }, [selector, pageHeightMm]);
}
