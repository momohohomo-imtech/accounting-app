"use client";

import { useState } from "react";
import { updateBankAccountMemo } from "@/lib/actions/bank";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { isLeaveDialogFocus, useUnsavedGuard } from "@/components/UnsavedChangesProvider";
import { fieldClass } from "@/components/ui/field";

// 계좌 카드의 메모 — 입력칸에서 벗어나면 자동 저장, 쓰는 중에 화면을 떠나면 저장할지 물어봄(useUnsavedGuard)
export function BankAccountMemo({ accountId, initialMemo, label }: { accountId: string; initialMemo: string; label: string }) {
  const [memo, setMemo] = useState(initialMemo);
  const [saved, setSaved] = useState(initialMemo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const globalPending = useGlobalPending();

  async function persist(): Promise<boolean> {
    if (memo === saved) return true;
    const fd = new FormData();
    fd.append("id", accountId);
    fd.append("memo", memo);
    // 실패하면 적은 글은 그대로 두고 이유를 보여 줌(다음에 칸을 벗어날 때 다시 저장) — 예전엔 결과를 버려서 저장이 안 돼도
    // 된 것처럼 보였음
    setSaving(true);
    const result = await globalPending.run(() => updateBankAccountMemo(fd));
    setSaving(false);
    if (result?.error) {
      setError(`메모를 저장하지 못했습니다: ${result.error}`);
      return false;
    }
    setError(null);
    setSaved(memo);
    return true;
  }

  useUnsavedGuard({ dirty: memo !== saved && !saving, value: memo, label, save: persist, discard: () => setMemo(saved) });

  return (
    <>
      <textarea
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        onBlur={(e) => {
          if (isLeaveDialogFocus(e.relatedTarget)) return;
          void persist();
        }}
        rows={2}
        placeholder="메모..."
        className={`${fieldClass} mt-3 resize-y text-xs print:hidden`}
      />
      {error && <p className="mt-1 text-xs text-red-600 print:hidden">{error}</p>}
    </>
  );
}
