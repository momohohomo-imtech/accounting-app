"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { postRecurringExpensesNow } from "@/lib/actions/recurringExpenses";

// 고정지출 탭 "지금 올리기" — 올릴 차례인 항목(결제일이 됐는데 아직 안 올라간 것)을 바로 매입장에 "분류 대기"로. 매일 아침 서버가 하는
// 것과 같은 일이라 두 번 눌러도 같은 달은 한 번만 올라감.
export function RecurringPostNowButton({ dueCount }: { dueCount: number }) {
  const pending = useGlobalPending();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant={dueCount > 0 ? "primary" : "secondary"}
        onClick={async () => {
          setMessage(null);
          setError(null);
          const result = await pending.run(() => postRecurringExpensesNow());
          if (result?.error) setError(result.error);
          else setMessage(result?.message ?? null);
        }}
      >
        {dueCount > 0 ? `올릴 차례 ${dueCount}건 지금 올리기` : "지금 올리기"}
      </Button>
      {message && <span className="text-sm text-emerald-700">{message}</span>}
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
