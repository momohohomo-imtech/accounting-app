"use client";

import { useRef, useState } from "react";
import { updateBankAccountMemo } from "@/lib/actions/bank";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { fieldClass } from "@/components/ui/field";

export function BankAccountMemo({ accountId, initialMemo }: { accountId: string; initialMemo: string }) {
  const [memo, setMemo] = useState(initialMemo);
  const [error, setError] = useState<string | null>(null);
  const lastSavedRef = useRef(initialMemo);
  const globalPending = useGlobalPending();

  async function handleBlur() {
    if (memo === lastSavedRef.current) return;
    const fd = new FormData();
    fd.append("id", accountId);
    fd.append("memo", memo);
    // 실패하면 적은 글은 그대로 두고 이유를 보여 줌(다음에 칸을 벗어날 때 다시 저장) — 예전엔 결과를 버려서 저장이 안 돼도
    // 된 것처럼 보였음
    const result = await globalPending.run(() => updateBankAccountMemo(fd));
    if (result?.error) {
      setError(`메모를 저장하지 못했습니다: ${result.error}`);
      return;
    }
    setError(null);
    lastSavedRef.current = memo;
  }

  return (
    <>
      <textarea
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        onBlur={handleBlur}
        rows={2}
        placeholder="메모..."
        className={`${fieldClass} mt-3 resize-y text-xs print:hidden`}
      />
      {error && <p className="mt-1 text-xs text-red-600 print:hidden">{error}</p>}
    </>
  );
}
