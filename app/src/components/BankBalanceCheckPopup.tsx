"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ModalPortal } from "@/components/ModalPortal";
import { Button } from "@/components/ui/Button";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { fieldClass, labelClass } from "@/components/ui/field";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { deleteBankBalanceCheck, saveBankBalanceCheck } from "@/lib/actions/bank";
import { formatWon } from "@/lib/format";
import type { CheckedBalance } from "@/lib/bankReconcile";

type SortKey = "check_date" | "actual_balance" | "app_balance" | "diff" | "memo";

function DiffText({ diff }: { diff: number }) {
  if (diff === 0) return <span className="font-medium text-emerald-700">일치</span>;
  return (
    <span className="whitespace-nowrap font-medium text-red-600">
      차이 {diff > 0 ? "+" : ""}
      {formatWon(diff)}
    </span>
  );
}

// 계좌 카드의 "잔액 맞추기" — 은행 앱에서 본 실제 잔액을 적으면 그 날까지 입력한 거래로 계산한 잔액과 비교(lib/bankReconcile.ts).
export function BankBalanceCheckPopup({
  accountId,
  accountName,
  appBalanceToday,
  today,
  rows,
}: {
  accountId: string;
  accountName: string;
  appBalanceToday: number;
  today: string;
  rows: CheckedBalance[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("check_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const router = useRouter();
  const pending = useGlobalPending();
  const confirm = useConfirm();
  useEscapeKey(open, () => setOpen(false));
  const latest = rows[0] ?? null;

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }
  function headerButton(key: SortKey, label: string) {
    return (
      <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 hover:text-slate-800">
        {label}
        {sortKey === key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  }
  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = sortKey === "memo" ? (a.memo ?? "") : a[sortKey];
      const vb = sortKey === "memo" ? (b.memo ?? "") : b[sortKey];
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  // onSubmit(form action 아님) — 저장이 실패해도 입력한 잔액이 지워지지 않게.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("bank_account_id", accountId);
    const result = await pending.run(() => saveBankBalanceCheck(fd));
    if (result?.error) {
      setError(`저장하지 못했습니다: ${result.error}`);
      return;
    }
    setError(null);
    form.reset();
    router.refresh();
  }

  async function handleDelete(row: CheckedBalance) {
    if (!(await confirm(`${row.check_date} 잔액 확인 기록을 삭제하시겠습니까?`))) return;
    const fd = new FormData();
    fd.set("id", row.id);
    const result = await pending.run(() => deleteBankBalanceCheck(fd));
    if (result?.error) {
      setError(`삭제하지 못했습니다: ${result.error}`);
      return;
    }
    setError(null);
    router.refresh();
  }

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
        {latest ? (
          <span>
            {latest.check_date.slice(5).replace("-", "/")} 통장 확인: <DiffText diff={latest.diff} />
          </span>
        ) : (
          <span>통장 잔액 확인 기록 없음</span>
        )}
        <button type="button" onClick={() => setOpen(true)} className="text-brand underline-offset-2 hover:underline">
          잔액 맞추기
        </button>
      </div>

      {open && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-ink/50 p-4 py-10"
            onClick={() => setOpen(false)}
          >
            <div className="w-full max-w-2xl space-y-4 rounded-2xl bg-white p-5 shadow-xl sm:p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900">{accountName} 잔액 맞추기</h2>
                <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500 hover:text-slate-800">
                  닫기
                </button>
              </div>
              <p className="text-xs text-slate-500">
                은행 앱에서 본 잔액을 날짜와 함께 적으면, 그 날까지 이 화면에 입력한 거래로 계산한 잔액과 비교합니다. 차이가 있으면
                빠뜨렸거나 두 번 입력한 통장 거래가 있다는 뜻입니다(같은 날 다시 적으면 고쳐 씀). 앱 계산 잔액(오늘):{" "}
                <span className="whitespace-nowrap font-medium text-slate-700">{formatWon(appBalanceToday)}</span>
              </p>

              <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                <label className="flex flex-col gap-1">
                  <span className={labelClass}>확인한 날짜</span>
                  <input type="date" name="check_date" required defaultValue={today} max={today} className={fieldClass} />
                </label>
                <label className="flex min-w-0 flex-col gap-1">
                  <span className={labelClass}>통장 실제 잔액</span>
                  <MoneyInput name="actual_balance" required allowNegative placeholder="은행 앱의 잔액" className={fieldClass} />
                </label>
                <label className="flex min-w-0 flex-col gap-1">
                  <span className={labelClass}>메모</span>
                  <input name="memo" placeholder="선택" className={fieldClass} />
                </label>
                <Button type="submit" size="sm">
                  저장
                </Button>
              </form>
              {error && <p className="text-sm text-red-600">{error}</p>}

              {rows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-500">
                        <th className="pb-2 pr-3">{headerButton("check_date", "날짜")}</th>
                        <th className="pb-2 pr-3 text-right">{headerButton("actual_balance", "통장 잔액")}</th>
                        <th className="pb-2 pr-3 text-right">{headerButton("app_balance", "앱 계산 잔액")}</th>
                        <th className="pb-2 pr-3 text-right">{headerButton("diff", "차이")}</th>
                        <th className="pb-2 pr-3">{headerButton("memo", "메모")}</th>
                        <th className="pb-2 text-right">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((r) => (
                        <tr key={r.id} className="border-b border-slate-100">
                          <td className="py-2 pr-3 tabular-nums text-slate-700">{r.check_date}</td>
                          <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums">{formatWon(r.actual_balance)}</td>
                          <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums text-slate-600">{formatWon(r.app_balance)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            <DiffText diff={r.diff} />
                          </td>
                          <td className="py-2 pr-3 text-slate-500 max-md:max-w-[10rem] max-md:truncate" title={r.memo ?? undefined}>
                            {r.memo ?? ""}
                          </td>
                          <td className="py-2 text-right">
                            <Button variant="danger" size="xs" type="button" onClick={() => handleDelete(r)}>
                              삭제
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-400">아직 확인한 기록이 없습니다.</p>
              )}
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
