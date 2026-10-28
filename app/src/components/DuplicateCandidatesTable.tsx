"use client";

import { Fragment, useMemo, useState } from "react";
import { formatDate, formatWon } from "@/lib/format";
import { kstDateTime } from "@/lib/kstDate";
import { deleteTransactionRecord } from "@/lib/actions/transactions";
import { Button, LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

export type DuplicateLine = {
  id: string;
  projectName: string | null;
  categoryName: string | null;
  credit: boolean;
  createdAt: string | null;
};
export type DuplicateGroup = {
  key: string;
  date: string;
  type: string;
  client: string;
  item: string;
  total: number;
  lines: DuplicateLine[];
};
type SortKey = "date" | "client" | "item" | "total" | "count";

// 장부 점검 — 같은 날·같은 거래처·같은 품목·같은 금액 거래 묶음(lib/ledgerCheck.ts). 묶음 단위로 정렬, 줄마다 수정·삭제.
export function DuplicateCandidatesTable({ groups, year }: { groups: DuplicateGroup[]; year: number }) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();
  const pending = useGlobalPending();

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    const value = (g: DuplicateGroup) => (sortKey === "count" ? g.lines.length : g[sortKey]);
    return [...groups].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ko");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [groups, sortKey, sortDir]);

  async function handleDelete(g: DuplicateGroup, line: DuplicateLine) {
    const ok = await confirm(
      `${formatDate(g.date)} ${g.client || "거래처 없음"} ${formatWon(g.total)} 거래 중 이 줄을 삭제할까요? 삭제하면 되돌릴 수 없어요.`,
      { danger: true, confirmLabel: "삭제" }
    );
    if (!ok) return;
    const fd = new FormData();
    fd.append("id", line.id);
    const result = await pending.run(() => deleteTransactionRecord(fd));
    setError(result?.error ?? null);
  }

  function headerButton(key: SortKey, label: string) {
    return (
      <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 hover:text-slate-800">
        {label}
        {sortKey === key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  }

  if (groups.length === 0) {
    return <p className="text-sm text-slate-400">같은 날·같은 거래처·같은 품목·같은 금액으로 두 번 이상 등록된 거래가 없어요.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        같은 날·같은 거래처·같은 품목·같은 금액(부가세 포함)으로 두 번 이상 등록된 거래예요(한 결제로 묶어 나눈 줄은 제외). 실제로
        두 번 산 거면 그대로 두셔도 돼요. 잘못 두 번 넣은 거면 한 줄을 삭제하세요.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto">
        <table className="sticky-col-table w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="whitespace-nowrap pb-2 pr-4 font-medium">{headerButton("date", "날짜")}</th>
              <th className="sticky-col whitespace-nowrap pb-2 pr-4 font-medium">{headerButton("client", "거래처")}</th>
              <th className="whitespace-nowrap pb-2 pr-4 font-medium">{headerButton("item", "품목")}</th>
              <th className="whitespace-nowrap pb-2 pr-4 text-right font-medium">{headerButton("total", "금액")}</th>
              <th className="whitespace-nowrap pb-2 pr-4 font-medium">{headerButton("count", "건수")}</th>
              <th className="whitespace-nowrap pb-2 pr-4 font-medium">프로젝트</th>
              <th className="whitespace-nowrap pb-2 pr-4 font-medium">카테고리</th>
              <th className="whitespace-nowrap pb-2 pr-4 font-medium">등록 시각</th>
              <th className="whitespace-nowrap pb-2 text-right font-medium">관리</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((g) => (
              <Fragment key={g.key}>
                {g.lines.map((line, i) => (
                  <tr key={line.id} className={i === 0 ? "border-t-2 border-slate-200" : "border-t border-slate-100"}>
                    <td className="whitespace-nowrap py-2 pr-4 text-slate-700">
                      {formatDate(g.date)} <span className="text-xs text-slate-400">{g.type}</span>
                    </td>
                    <td
                      className="sticky-col py-2 pr-4 text-slate-800 max-md:max-w-[10rem] max-md:truncate"
                      title={g.client || undefined}
                    >
                      {g.client || <span className="text-slate-400">거래처 없음</span>}
                    </td>
                    <td className="py-2 pr-4 text-slate-700 max-md:max-w-[10rem] max-md:truncate" title={g.item || undefined}>
                      {g.item || "-"}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4 text-right tabular-nums text-slate-900">{formatWon(g.total)}</td>
                    <td className="whitespace-nowrap py-2 pr-4">
                      {i === 0 ? <Badge variant="amber">{g.lines.length}건</Badge> : null}
                      {line.credit && <span className="ml-1 text-xs text-slate-400">외상</span>}
                    </td>
                    <td className="py-2 pr-4 text-slate-600 max-md:max-w-[10rem] max-md:truncate">{line.projectName ?? "일반경비"}</td>
                    <td className="whitespace-nowrap py-2 pr-4 text-slate-600">{line.categoryName ?? "-"}</td>
                    <td className="whitespace-nowrap py-2 pr-4 text-xs text-slate-400">
                      {line.createdAt ? kstDateTime(line.createdAt) : "-"}
                    </td>
                    <td className="whitespace-nowrap py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <LinkButton href={`/transactions?tab=check&year=${year}&editTx=${line.id}`} variant="secondary" size="xs">
                          수정
                        </LinkButton>
                        <Button type="button" variant="danger" size="xs" onClick={() => handleDelete(g, line)}>
                          삭제
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
