"use client";

import { useMemo, useState } from "react";

// 표에서 체크한 거래(보고서 내역 표 일괄 변경 — 11/11). 바꿀 때는 지금 보이는 줄 중 체크한 것만(chosen) — 필터·검색으로 숨은 줄은
// 체크가 남아 있어도 안 바뀌게. 전체 선택도 보이는 줄만.
export function useRowSelection(visibleIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const chosen = useMemo(() => visibleIds.filter((id) => selected.has(id)), [visibleIds, selected]);
  const allOn = visibleIds.length > 0 && chosen.length === visibleIds.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allOn ? new Set() : new Set(visibleIds));
  }

  function clear() {
    setSelected(new Set());
  }

  return { selected, chosen, allOn, toggle, toggleAll, clear };
}
