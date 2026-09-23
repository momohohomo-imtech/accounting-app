"use client";

import { useRef, useState } from "react";
import { updateBankAccountMemo } from "@/lib/actions/bank";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { fieldClass } from "@/components/ui/field";

export function BankAccountMemo({ accountId, initialMemo }: { accountId: string; initialMemo: string }) {
  const [memo, setMemo] = useState(initialMemo);
  const lastSavedRef = useRef(initialMemo);
  const globalPending = useGlobalPending();

  async function handleBlur() {
    if (memo === lastSavedRef.current) return;
    const fd = new FormData();
    fd.append("id", accountId);
    fd.append("memo", memo);
    await globalPending.run(() => updateBankAccountMemo(fd));
    lastSavedRef.current = memo;
  }

  return (
    <textarea
      value={memo}
      onChange={(e) => setMemo(e.target.value)}
      onBlur={handleBlur}
      rows={2}
      placeholder="메모..."
      className={`${fieldClass} mt-3 resize-y text-xs print:hidden`}
    />
  );
}
