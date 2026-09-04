"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/field";
import { upsertHalfYearProfit } from "@/lib/actions/dashboard";

export function HalfYearSettlementInput({ year, initialAmount }: { year: number; initialAmount: number | null }) {
  const router = useRouter();
  const globalPending = useGlobalPending();
  const [editing, setEditing] = useState(initialAmount == null);
  const [value, setValue] = useState(initialAmount != null ? String(initialAmount) : "");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (value === "" || Number.isNaN(Number(value))) {
      setError("금액을 입력해 주세요.");
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.append("year", String(year));
    fd.append("half", "1");
    fd.append("amount", value);
    const result = await globalPending.run(() => upsertHalfYearProfit(fd));
    if (result && "error" in result && result.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs text-blue-700 underline underline-offset-2 hover:text-blue-900"
      >
        수정
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="상반기 확정 이익금"
        className={`${fieldClass} w-40`}
      />
      <Button type="submit" size="xs">
        저장
      </Button>
      {initialAmount != null && (
        <Button type="button" variant="secondary" size="xs" onClick={() => setEditing(false)}>
          취소
        </Button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
