"use client";

import { Fragment, useMemo, useState } from "react";
import { formatDate, formatWon } from "@/lib/format";
import { kstDateTime } from "@/lib/kstDate";
import { deleteTransactionRecord } from "@/lib/actions/transactions";
import { dismissDuplicateGroup, undismissDuplicateGroup } from "@/lib/actions/duplicateDismissals";
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
// 실제로 두 번 산 게 맞는 묶음은 "숨기기"로 표에서 빼고(106 SQL, 11/14 사용자 요청) 아래 "숨긴 묶음"에서 다시 보이게 할 수 있음 —
// 거래는 그대로. 106 실행 전(dismissReady=false)이나 조회 전용 계정은 숨기기 버튼 없음.
export function DuplicateCandidatesTable({
  groups,
  hiddenGroups = [],
  year,
  dismissReady = false,
  canEdit = false,
}: {
  groups: DuplicateGroup[];
  hiddenGroups?: DuplicateGroup[];
  year: number;
  dismissReady?: boolean;
  canEdit?: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showHidden, setShowHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();
  const pending = useGlobalPending();
  const canDismiss = dismissReady && canEdit;

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortGroups = useMemo(() => {
    const value = (g: DuplicateGroup) => (sortKey === "count" ? g.lines.length : g[sortKey]);
    return (list: DuplicateGroup[]) =>
      [...list].sort((a, b) => {
        const va = value(a);
        const vb = value(b);
        const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ko");
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [sortKey, sortDir]);
  const sorted = useMemo(() => sortGroups(groups), [sortGroups, groups]);
  const sortedHidden = useMemo(() => sortGroups(hiddenGroups), [sortGroups, hiddenGroups]);

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

  // 숨기기·다시 보이기 — 거래는 그대로, 묶음 거래 id들(숨김 열쇠)만 저장·삭제. 되돌릴 수 있어 확인창 없이 바로.
  async function handleDismiss(g: DuplicateGroup, hide: boolean) {
    const fd = new FormData();
    g.lines.forEach((l) => fd.append("transaction_ids", l.id));
    const result = await pending.run(() => (hide ? dismissDuplicateGroup(fd) : undismissDuplicateGroup(fd)));
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

  function table(list: DuplicateGroup[], hidden: boolean) {
    return (
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
            {list.map((g) => (
              <Fragment key={g.key}>
                {g.lines.map((line, i) => (
                  <tr
                    key={line.id}
                    className={`${i === 0 ? "border-t-2 border-slate-200" : "border-t border-slate-100"} ${hidden ? "text-slate-500" : ""}`}
                  >
                    <td className="whitespace-nowrap py-2 pr-4 text-slate-700">
                      {formatDate(g.date)} <span className="text-xs text-slate-400">{g.type}</span>
                    </td>
                    <td
                      tabIndex={0}
                      className="tap-full sticky-col py-2 pr-4 text-slate-800 max-md:max-w-[10rem] max-md:truncate"
                      title={g.client || undefined}
                    >
                      {g.client || <span className="text-slate-400">거래처 없음</span>}
                    </td>
                    <td
                      tabIndex={0}
                      className="tap-full py-2 pr-4 text-slate-700 max-md:max-w-[10rem] max-md:truncate"
                      title={g.item || undefined}
                    >
                      {g.item || "-"}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4 text-right tabular-nums text-slate-900">{formatWon(g.total)}</td>
                    <td className="whitespace-nowrap py-2 pr-4">
                      {i === 0 ? <Badge variant={hidden ? "slate" : "amber"}>{g.lines.length}건</Badge> : null}
                      {line.credit && <span className="ml-1 text-xs text-slate-400">외상</span>}
                    </td>
                    <td
                      tabIndex={0}
                      className="tap-full py-2 pr-4 text-slate-600 max-md:max-w-[10rem] max-md:truncate"
                      title={line.projectName ?? "일반경비"}
                    >
                      {line.projectName ?? "일반경비"}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4 text-slate-600">{line.categoryName ?? "-"}</td>
                    <td className="whitespace-nowrap py-2 pr-4 text-xs text-slate-400">
                      {line.createdAt ? kstDateTime(line.createdAt) : "-"}
                    </td>
                    <td className="whitespace-nowrap py-2 text-right">
                      <div className="flex justify-end gap-2">
                        {i === 0 && canDismiss && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            onClick={() => handleDismiss(g, !hidden)}
                            title={
                              hidden
                                ? "이 묶음을 중복 의심 표에 다시 보이게 합니다"
                                : "실제로 두 번 산 게 맞으면 — 표에서 숨김(거래는 그대로, 아래 '숨긴 묶음'에서 다시 보이게 할 수 있음)"
                            }
                          >
                            {hidden ? "다시 보이기" : "숨기기"}
                          </Button>
                        )}
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
    );
  }

  return (
    <div className="space-y-2">
      {groups.length === 0 ? (
        <p className="text-sm text-slate-400">
          {hiddenGroups.length > 0
            ? "확인할 중복 의심 거래가 없어요(숨긴 묶음만 있어요)."
            : "같은 날·같은 거래처·같은 품목·같은 금액으로 두 번 이상 등록된 거래가 없어요."}
        </p>
      ) : (
        <>
          <p className="text-xs text-slate-500">
            같은 날·같은 거래처·같은 품목·같은 금액(부가세 포함)으로 두 번 이상 등록된 거래예요(한 결제로 묶어 나눈 줄은 제외).{" "}
            {canDismiss
              ? "실제로 두 번 산 거면 \"숨기기\"를 누르세요 — 표에서 빠지고 거래는 그대로예요(아래 \"숨긴 묶음\"에서 다시 볼 수 있어요). 잘못 두 번 넣은 거면 한 줄을 삭제하세요."
              : "실제로 두 번 산 거면 그대로 두셔도 돼요. 잘못 두 번 넣은 거면 한 줄을 삭제하세요."}
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {table(sorted, false)}
        </>
      )}
      {hiddenGroups.length > 0 && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowHidden((v) => !v)}
            aria-expanded={showHidden}
            className="text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-800"
          >
            {showHidden ? "숨긴 묶음 접기" : `숨긴 묶음 ${hiddenGroups.length.toLocaleString("ko-KR")}건 보기`}
          </button>
          {showHidden && (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-slate-500">실제로 두 번 산 거라고 숨긴 묶음이에요. 같은 거래가 하나 더 들어오면 다시 표에 나와요.</p>
              {groups.length === 0 && error && <p className="text-sm text-red-600">{error}</p>}
              {table(sortedHidden, true)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
