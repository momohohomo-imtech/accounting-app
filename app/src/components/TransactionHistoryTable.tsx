"use client";

import { useMemo, useState } from "react";
import { formatDate, formatWon } from "@/lib/format";
import type { HistoryView } from "@/lib/transactionHistoryLoad";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type SortKey = "changedAt" | "who" | "action" | "date" | "client" | "item" | "total";

// 장부 점검 — 최근 거래 수정·삭제 이력(094 SQL). 삭제된 거래는 지우기 전 값으로 보여 줌. 한꺼번에 바뀐 묶음(백업 복원·
// 여러 건 선택 삭제·일괄 변경)은 한 줄로(거래 수만).
export function TransactionHistoryTable({ rows, year }: { rows: HistoryView[]; year: number }) {
  const [sortKey, setSortKey] = useState<SortKey>("changedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const va = a[sortKey];
        const vb = b[sortKey];
        const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ko");
        return sortDir === "asc" ? cmp : -cmp;
      }),
    [rows, sortKey, sortDir]
  );

  function headerButton(key: SortKey, label: string) {
    return (
      <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 hover:text-slate-800">
        {label}
        {sortKey === key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  }

  if (rows.length === 0) return <p className="text-sm text-slate-400">아직 수정·삭제한 거래가 없어요.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="sticky-col-table w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="whitespace-nowrap pb-2 pr-4 font-medium">{headerButton("changedAt", "바꾼 시각")}</th>
            <th className="whitespace-nowrap pb-2 pr-4 font-medium">{headerButton("who", "누가")}</th>
            <th className="whitespace-nowrap pb-2 pr-4 font-medium">{headerButton("action", "구분")}</th>
            <th className="whitespace-nowrap pb-2 pr-4 font-medium">{headerButton("date", "거래일")}</th>
            <th className="sticky-col whitespace-nowrap pb-2 pr-4 font-medium">{headerButton("client", "거래처")}</th>
            <th className="whitespace-nowrap pb-2 pr-4 font-medium">{headerButton("item", "품목")}</th>
            <th className="whitespace-nowrap pb-2 pr-4 text-right font-medium">{headerButton("total", "금액")}</th>
            <th className="pb-2 pr-4 font-medium">바뀐 내용</th>
            <th className="whitespace-nowrap pb-2 text-right font-medium">관리</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((h) => (
            <tr key={h.id} className="border-b border-slate-100 align-top last:border-0">
              <td className="whitespace-nowrap py-2 pr-4 text-xs text-slate-500">{h.time}</td>
              <td className="whitespace-nowrap py-2 pr-4 text-slate-700">{h.who}</td>
              <td className="whitespace-nowrap py-2 pr-4">
                {h.action === "delete" ? (
                  <Badge variant="red">{h.bulkCount ? "일괄 삭제" : "삭제"}</Badge>
                ) : (
                  <Badge variant="slate">{h.bulkCount ? "일괄 수정" : "수정"}</Badge>
                )}
              </td>
              {h.bulkCount ? (
                <td colSpan={4} className="py-2 pr-4 text-slate-700">
                  거래 {h.bulkCount.toLocaleString()}건을 한 번에 {h.action === "delete" ? "삭제" : "수정"}
                </td>
              ) : (
                <>
                  <td className="whitespace-nowrap py-2 pr-4 text-slate-700">
                    {formatDate(h.date)} <span className="text-xs text-slate-400">{h.type}</span>
                  </td>
                  <td
                    tabIndex={0}
                    className="tap-full sticky-col py-2 pr-4 text-slate-800 max-md:max-w-[10rem] max-md:truncate"
                    title={h.client}
                  >
                    {h.client}
                  </td>
                  <td
                    tabIndex={0}
                    className="tap-full py-2 pr-4 text-slate-700 max-md:max-w-[10rem] max-md:truncate"
                    title={h.item || undefined}
                  >
                    {h.item || "-"}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4 text-right tabular-nums text-slate-900">{formatWon(h.total)}</td>
                </>
              )}
              <td className="min-w-[16rem] py-2 pr-4 text-xs text-slate-600">
                {h.action === "delete"
                  ? h.bulkCount
                    ? h.restored
                      ? "백업 복원으로 보임(지운 거래가 지금 다시 있음) — 복원은 거래를 모두 지운 뒤 백업 내용으로 다시 넣음"
                      : "선택 삭제 등으로 한 번에 지움"
                    : h.restored
                      ? "거래 삭제 — 이후 백업 복원으로 다시 들어옴"
                      : "거래 삭제(지우기 전 값)"
                  : h.changes.length > 0
                    ? [
                        h.bulkCount ? (
                          <span key="sample" className="block text-slate-400">
                            앞쪽 몇 건의 바뀐 내용
                          </span>
                        ) : null,
                        ...h.changes.map((c) => (
                          <span key={`${c.label}|${c.before}|${c.after}`} className="block">
                            <span className="text-slate-400">{c.label}</span> {c.before} → <span className="font-medium text-slate-800">{c.after}</span>
                          </span>
                        )),
                      ]
                    : "화면에 보이는 칸은 바뀌지 않음"}
              </td>
              <td className="whitespace-nowrap py-2 text-right">
                {((h.action === "update" && !h.bulkCount) || (h.restored && !h.bulkCount)) && (
                  <LinkButton href={`/transactions?tab=check&year=${year}&editTx=${h.transactionId}`} variant="secondary" size="xs">
                    수정
                  </LinkButton>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
