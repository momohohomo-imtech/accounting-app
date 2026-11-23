"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { cx } from "@/lib/cx";
import { compareProjectCodeDesc } from "@/lib/projectCode";
import { formatProfitRate, type ProjectOverviewRow, type ProjectOverviewTotals } from "@/lib/projectOverview";

// 보고서 "프로젝트 한눈에 보기"(사용자 요청 11/23): 위 = 전체 요약(첫 줄 손익 5칸, 둘째 줄 근무 3칸), 아래 = 프로젝트별 표(같은 8가지,
// 머리글 정렬, 이름을 누르면 프로젝트 보고서, 합계 줄 = 위 요약). 계산은 lib/projectOverview.ts. 요약 칸은 휴대폰에서 한 줄에
// 하나(이름 왼쪽·숫자 오른쪽), PC·인쇄는 칸으로 — 휴대폰용 max-md: 클래스는 A4 인쇄에도 걸려서 두 모양을 따로 그림.

const num = (n: number) => n.toLocaleString("ko-KR");

type Tile = { label: string; value: string; unit?: string; sub: string; key?: boolean; negative?: boolean };

function TileValue({ tile, className }: { tile: Tile; className?: string }) {
  return (
    <span
      className={cx(
        "whitespace-nowrap font-bold tabular-nums",
        tile.negative ? "text-red-600" : tile.key ? "text-brand-navy" : "text-slate-900",
        className
      )}
    >
      {tile.value}
      {tile.unit && tile.value !== "-" && <span className="ml-0.5 text-[0.75em] font-semibold">{tile.unit}</span>}
    </span>
  );
}

function TileRow({ label, tiles, gridClass }: { label: string; tiles: Tile[]; gridClass: string }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-slate-500 print:mb-1 print:text-[9px]">{label}</p>
      {/* 휴대폰: 한 줄에 하나 */}
      <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 md:hidden print:hidden">
        {tiles.map((t) => (
          <div key={t.label} className={cx("grid grid-cols-[1fr_auto] items-baseline gap-x-3 px-3 py-2.5", t.key && "bg-brand-soft")}>
            <span className="text-sm text-slate-600">{t.label}</span>
            <TileValue tile={t} className="text-right text-base" />
            <span className="col-span-2 text-right text-[11px] text-slate-400">{t.sub}</span>
          </div>
        ))}
      </div>
      {/* PC·인쇄: 칸 */}
      <div className={cx("hidden gap-2.5 md:grid print:grid print:gap-1.5", gridClass)}>
        {tiles.map((t) => (
          <div
            key={t.label}
            className={cx(
              "min-w-0 rounded-xl border px-3.5 py-3 print:rounded-md print:px-2 print:py-1.5",
              t.key ? "border-sky-100 bg-brand-soft" : "border-slate-200 bg-white"
            )}
          >
            <p className="text-[13px] text-slate-500 print:text-[9px]">{t.label}</p>
            <p className="mt-1 print:mt-0">
              <TileValue tile={t} className="text-lg 2xl:text-xl print:text-[13px]" />
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400 print:mt-0 print:text-[8px]">{t.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

type SortKey = "project" | "quote" | "contract" | "purchase" | "profit" | "profitRate" | "profitPerDay" | "workDays" | "tripCount";

function sortValue(r: ProjectOverviewRow, key: Exclude<SortKey, "project">): number {
  switch (key) {
    case "quote":
      return r.quote;
    case "contract":
      return r.contract;
    case "purchase":
      return r.purchase;
    case "profit":
      return r.profit;
    // "-"(계산 못 함)는 가장 작은 값으로 — 처음 누르면(큰 순) 맨 아래
    case "profitRate":
      return r.profitRate ?? Number.NEGATIVE_INFINITY;
    case "profitPerDay":
      return r.profitPerDay ?? Number.NEGATIVE_INFINITY;
    case "workDays":
      return r.workDays.total;
    case "tripCount":
      return r.tripCount;
  }
}

const cell = "whitespace-nowrap px-2 py-2 text-right tabular-nums print:px-1 print:py-0.5";
const workEdge = "border-l-2 border-slate-200";

export function ProjectOverview({
  rows,
  totals,
  year,
  site,
  siteLabel,
}: {
  rows: ProjectOverviewRow[];
  totals: ProjectOverviewTotals;
  year: number;
  site?: string;
  siteLabel?: string | null;
}) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // 같은 머리글을 다시 누르면 방향만 바꿈, 다른 머리글은 큰 순부터(같은 보고서의 "프로젝트별 손익" 표와 같게)
  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      // 프로젝트 = 번호 순("2026-1000"이 "2026-999"보다 뒤로 가지 않게 compareProjectCodeDesc), 큰 순 = 최근 번호가 위
      const cmp =
        sortKey === "project"
          ? -compareProjectCodeDesc(a.code, b.code) || a.name.localeCompare(b.name, "ko")
          : sortValue(a, sortKey) - sortValue(b, sortKey);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function header(key: SortKey, label: ReactNode) {
    return (
      <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 hover:text-slate-800">
        {label}
        {sortKey === key && <span className="text-[10px] print:hidden">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  }

  const t = totals;
  const moneyTiles: Tile[] = [
    { label: "발주액", value: num(t.quote), unit: "원", sub: t.reviewCount > 0 ? "원청 발주금액 합계 · 검토중 제외" : "원청 발주금액 합계" },
    { label: "수주액", value: num(t.contract), unit: "원", sub: "발주액 − 대행구매", negative: t.contract < 0 },
    { label: "매입", value: num(t.purchase), unit: "원", sub: "공급가액 기준" },
    { label: "이익금", value: num(t.profit), unit: "원", sub: "수주액 − 매입", key: true, negative: t.profit < 0 },
    {
      label: "이익율",
      value: t.profitRate === null ? "-" : t.profitRate.toFixed(2),
      unit: "%",
      sub: "이익금 ÷ 발주액",
      key: true,
      negative: (t.profitRate ?? 0) < 0,
    },
  ];
  const workTiles: Tile[] = [
    {
      label: "근무일당 이익금",
      value: t.profitPerDay === null ? "-" : num(t.profitPerDay),
      unit: "원",
      sub: "이익금 ÷ 근무일",
      key: true,
      negative: (t.profitPerDay ?? 0) < 0,
    },
    { label: "근무일", value: num(t.workDays.total), unit: "일", sub: `사내 ${num(t.workDays.inhouse)}일 · 출장 ${num(t.workDays.trip)}일` },
    {
      label: "출장 횟수",
      value: num(t.tripCount),
      unit: "회",
      sub: `출장일 ${num(t.workDays.trip)}일 · 이어진 날은 1회${t.avgTripDays === null ? "" : ` · 평균 ${t.avgTripDays.toFixed(1)}일`}`,
    },
  ];

  const reportHref = (id: string) => `/reports?year=${year}${site ? `&site=${site}` : ""}&project=${id}`;

  return (
    <div className="space-y-3.5 print:space-y-2">
      <p className="text-xs text-slate-500 print:text-[9px]">
        {year}년{siteLabel ? ` · ${siteLabel}` : ""} 프로젝트 {num(t.count)}건
        {t.reviewCount > 0 && ` · 검토중 ${num(t.reviewCount)}건은 발주액 제외(이미 쓴 매입은 포함)`}
      </p>

      <TileRow label="손익" tiles={moneyTiles} gridClass="md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 print:grid-cols-5" />
      <TileRow label="근무" tiles={workTiles} gridClass="md:grid-cols-2 lg:grid-cols-3 print:grid-cols-3" />

      <div>
        <p className="mb-1.5 text-xs font-semibold text-slate-500 print:mb-1 print:text-[9px]">
          프로젝트별
          <span className="font-normal text-slate-400 print:hidden"> — 머리글을 누르면 정렬, 이름을 누르면 프로젝트 보고서</span>
        </p>
        <div className="overflow-x-auto rounded-xl border border-slate-200 print:overflow-visible print:rounded-none print:border-0">
          <table className="w-full min-w-[940px] text-[13px] xl:min-w-0 print:min-w-0 print:text-[9px]">
            <thead>
              <tr className="bg-slate-50 text-[11px] text-slate-400 print:bg-transparent print:text-[8px]">
                <th className="bg-slate-50 print:bg-transparent" />
                <th colSpan={5} className="pt-2 text-center font-semibold print:pt-0">
                  손익
                </th>
                <th colSpan={3} className={cx("pt-2 text-center font-semibold print:pt-0", workEdge)}>
                  근무
                </th>
              </tr>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 print:bg-transparent print:text-[8.5px]">
                <th className="bg-slate-50 px-2 py-2 text-left font-semibold print:bg-transparent print:px-1 print:py-0.5">
                  {header("project", "프로젝트")}
                </th>
                <th className={cx(cell, "font-semibold")}>{header("quote", "발주액")}</th>
                <th className={cx(cell, "font-semibold")}>{header("contract", "수주액")}</th>
                <th className={cx(cell, "font-semibold")}>{header("purchase", "매입")}</th>
                <th className={cx(cell, "font-semibold")}>{header("profit", "이익금")}</th>
                <th className={cx(cell, "font-semibold")}>{header("profitRate", "이익율")}</th>
                <th className={cx(cell, workEdge, "font-semibold")}>{header("profitPerDay", "근무일당 이익금")}</th>
                <th className={cx(cell, "font-semibold")}>{header("workDays", "근무일")}</th>
                <th className={cx(cell, "font-semibold")}>{header("tripCount", "출장 횟수")}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/60 print:break-inside-avoid">
                  <td className="px-2 py-2 text-left print:px-1 print:py-0.5">
                    <Link
                      href={reportHref(r.id)}
                      title={`${r.code ? `${r.code} ` : ""}${r.name}${r.memberCount > 1 ? ` (하위 ${r.memberCount - 1}건 합침)` : ""}`}
                      className="text-slate-700 hover:text-slate-900 hover:underline"
                    >
                      {r.code && <span className="text-slate-400">{r.code} </span>}
                      {r.name}
                      {r.review && (
                        <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-800 print:text-[7px]">검토중</span>
                      )}
                      {r.memberCount > 1 && (
                        <span className="ml-1 text-[11px] text-slate-400 print:text-[7px]">하위 {r.memberCount - 1}건 합침</span>
                      )}
                    </Link>
                  </td>
                  <td className={cx(cell, "text-slate-700")}>
                    {r.quote > 0 ? (
                      <>
                        {num(r.quote)}
                        {r.reviewQuote > 0 && (
                          <span className="block text-[10px] text-slate-400 print:text-[7px]">검토중 {num(r.reviewQuote)} 제외</span>
                        )}
                      </>
                    ) : r.reviewQuote > 0 ? (
                      <span className="text-slate-400 line-through" title="검토중 — 발주액은 합계에 넣지 않음">
                        {num(r.reviewQuote)}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className={cx(cell, r.contract < 0 ? "text-red-600" : "text-slate-700")}>
                    {r.quote === 0 && r.agency === 0 ? <span className="text-slate-400">-</span> : num(r.contract)}
                  </td>
                  <td className={cx(cell, "text-slate-700")}>{num(r.purchase)}</td>
                  <td className={cx(cell, "font-semibold", r.profit < 0 ? "text-red-600" : "text-slate-900")}>{num(r.profit)}</td>
                  <td className={cx(cell, (r.profitRate ?? 0) < 0 ? "text-red-600" : "text-slate-700")}>
                    {r.profitRate === null ? <span className="text-slate-400">-</span> : formatProfitRate(r.profitRate)}
                  </td>
                  <td
                    className={cx(cell, workEdge, "font-semibold", (r.profitPerDay ?? 0) < 0 ? "text-red-600" : "text-slate-900")}
                  >
                    {r.profitPerDay === null ? <span className="font-normal text-slate-400">-</span> : num(r.profitPerDay)}
                  </td>
                  <td className={cx(cell, "text-slate-700")} title={`사내 ${r.workDays.inhouse}일 · 출장 ${r.workDays.trip}일`}>
                    {r.workDays.total > 0 ? num(r.workDays.total) : <span className="text-slate-400">-</span>}
                  </td>
                  <td className={cx(cell, "text-slate-700")} title={`출장일 ${r.workDays.trip}일`}>
                    {r.tripCount > 0 ? num(r.tripCount) : <span className="text-slate-400">-</span>}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    {year}년 프로젝트가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
            {sorted.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-bold text-slate-900 print:bg-transparent">
                  <td className="bg-slate-50 px-2 py-2 text-left print:bg-transparent print:px-1 print:py-0.5">합계 {num(t.count)}건</td>
                  <td className={cell}>{num(t.quote)}</td>
                  <td className={cx(cell, t.contract < 0 && "text-red-600")}>{num(t.contract)}</td>
                  <td className={cell}>{num(t.purchase)}</td>
                  <td className={cx(cell, t.profit < 0 && "text-red-600")}>{num(t.profit)}</td>
                  <td className={cx(cell, (t.profitRate ?? 0) < 0 && "text-red-600")}>{formatProfitRate(t.profitRate)}</td>
                  <td className={cx(cell, workEdge, (t.profitPerDay ?? 0) < 0 && "text-red-600")}>
                    {t.profitPerDay === null ? "-" : num(t.profitPerDay)}
                  </td>
                  <td className={cell}>{num(t.workDays.total)}</td>
                  <td className={cell}>{num(t.tripCount)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <p className="mt-1.5 text-[11px] text-slate-400 print:text-[7.5px]">
          검토중 프로젝트는 발주액을 합계에 넣지 않고 이미 쓴 매입만 넣음 · 귀속 하위 프로젝트는 어미 줄에 합침 · 근무일·출장 횟수 합계 = 줄 합(같은
          날 두 프로젝트를 했으면 2일) · 금액은 부가세 제외
        </p>
      </div>
    </div>
  );
}
