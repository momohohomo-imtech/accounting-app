"use client";

import { useState } from "react";
import { formatWon } from "@/lib/format";

// 필터된 프로젝트의 총 매입(매입 합계 + 구매대행 합계) — 체크박스로 보이거나 숨길 수 있음.
export function TotalPurchaseSummary({ amount }: { amount: number }) {
  const [visible, setVisible] = useState(true);

  return (
    <label className="flex items-center gap-1.5">
      <input
        type="checkbox"
        checked={visible}
        onChange={(e) => setVisible(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-slate-300 accent-slate-900 print:hidden"
      />
      총 매입
      {visible && <span className="font-mono font-semibold text-slate-900"> {formatWon(amount)}</span>}
    </label>
  );
}
