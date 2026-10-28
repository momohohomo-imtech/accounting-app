"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { Button } from "@/components/ui/Button";
import { inlineFieldClass } from "@/components/ui/field";
import { upsertVatPrepaymentNotice } from "@/lib/actions/dashboard";
import { MoneyInput } from "@/components/ui/MoneyInput";

// 부가가치세 예정고지서 금액 입력(093 SQL) — 입력하면 확정신고 예상 납부세액에서 장부 기준 추정 대신 이 금액을 차감.
// 빈칸으로 저장하면 지워져 다시 추정으로.
export function VatNoticeInput({ year, month, initialAmount }: { year: number; month: 4 | 10; initialAmount: number | null }) {
  const router = useRouter();
  const globalPending = useGlobalPending();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialAmount != null ? String(initialAmount) : "");
  const [error, setError] = useState<string | null>(null);

  async function save(amount: string) {
    setError(null);
    const fd = new FormData();
    fd.append("year", String(year));
    fd.append("month", String(month));
    fd.append("amount", amount);
    const result = await globalPending.run(() => upsertVatPrepaymentNotice(fd));
    if (result && "error" in result && result.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (value !== "" && Number.isNaN(Number(value))) {
      setError("금액을 입력해 주세요.");
      return;
    }
    await save(value);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs text-brand underline underline-offset-2 hover:text-brand-dark print:hidden"
      >
        {initialAmount != null ? "고지서 금액 수정" : "고지서 금액 입력"}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 print:hidden">
      <MoneyInput
        value={value}
        onValueChange={setValue}
        placeholder={`${month}월 예정고지액`}
        className={`${inlineFieldClass} w-40`}
      />
      <Button type="submit" size="xs">
        저장
      </Button>
      {initialAmount != null && (
        <Button type="button" variant="secondary" size="xs" onClick={() => save("")}>
          추정으로 되돌리기
        </Button>
      )}
      <Button type="button" variant="secondary" size="xs" onClick={() => setEditing(false)}>
        취소
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
