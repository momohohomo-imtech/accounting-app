"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { inlineFieldClass } from "@/components/ui/field";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { lockYear, unlockYear } from "@/lib/actions/yearLock";
import { kstDateTime } from "@/lib/kstDate";
import type { LockedYear } from "@/lib/yearLock";

type SortKey = "year" | "locked_at" | "memo";

// 장부 점검 탭의 "신고 끝난 해 잠금"(097 SQL) — 잠그기·풀기는 관리자만, 나머지 계정은 보기만. 막는 범위는 lib/yearLock.ts.
export function YearLockPanel({ year, lockedYears, isAdmin }: { year: number; lockedYears: LockedYear[]; isAdmin: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [memo, setMemo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("year");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const router = useRouter();
  const pending = useGlobalPending();
  const confirm = useConfirm();
  const selectedLocked = lockedYears.some((y) => y.year === year);

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
    const copy = [...lockedYears];
    copy.sort((a, b) => {
      const va = sortKey === "memo" ? (a.memo ?? "") : a[sortKey];
      const vb = sortKey === "memo" ? (b.memo ?? "") : b[sortKey];
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [lockedYears, sortKey, sortDir]);

  async function handleLock() {
    const ok = await confirm(
      `${year}년을 잠글까요? 잠그면 그 해 거래를 추가·삭제할 수 없고 날짜·금액·거래처·카테고리·세금계산서·외상 여부를 바꿀 수 없습니다(프로젝트·결제수단·품목·메모·외상 정산은 그대로). 필요하면 여기서 다시 풀 수 있습니다.`
    );
    if (!ok) return;
    const fd = new FormData();
    fd.set("year", String(year));
    fd.set("memo", memo);
    const result = await pending.run(() => lockYear(fd));
    if (result?.error) {
      setError(`잠그지 못했습니다: ${result.error}`);
      return;
    }
    setError(null);
    setMemo("");
    router.refresh();
  }

  async function handleUnlock(target: number) {
    if (!(await confirm(`${target}년 잠금을 풀까요? 풀면 그 해 거래를 다시 고칠 수 있습니다.`))) return;
    const fd = new FormData();
    fd.set("year", String(target));
    const result = await pending.run(() => unlockYear(fd));
    if (result?.error) {
      setError(`잠금을 풀지 못했습니다: ${result.error}`);
      return;
    }
    setError(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        종합소득세·부가세 신고가 끝난 해를 잠그면 실수로 그 해 장부가 바뀌지 않습니다 — 그 해 거래를 추가·삭제할 수 없고 날짜·금액·
        거래처·카테고리·세금계산서·외상 여부를 바꿀 수 없습니다. 프로젝트·결제수단·품목·메모와 외상 정산은 그대로 되고, 백업 복원도
        잠금과 상관없이 됩니다.{!isAdmin && " 잠그기·풀기는 관리자만 할 수 있습니다."}
      </p>
      {isAdmin && !selectedLocked && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="메모 (선택, 예: 5월 신고 끝)"
            className={`${inlineFieldClass} w-56`}
          />
          <Button type="button" size="sm" onClick={handleLock}>
            {year}년 잠그기
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {lockedYears.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2 pr-3">{headerButton("year", "연도")}</th>
                <th className="pb-2 pr-3">{headerButton("locked_at", "잠근 시각")}</th>
                <th className="pb-2 pr-3">{headerButton("memo", "메모")}</th>
                {isAdmin && <th className="pb-2 text-right">관리</th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((y) => (
                <tr key={y.year} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-medium text-slate-800">{y.year}년</td>
                  <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-slate-600">{kstDateTime(y.locked_at)}</td>
                  <td className="py-2 pr-3 text-slate-500 max-md:max-w-[10rem] max-md:truncate" title={y.memo ?? undefined}>
                    {y.memo ?? ""}
                  </td>
                  {isAdmin && (
                    <td className="py-2 text-right">
                      <Button variant="secondary" size="xs" type="button" onClick={() => handleUnlock(y.year)}>
                        잠금 풀기
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-400">잠긴 해가 없습니다.</p>
      )}
    </div>
  );
}
