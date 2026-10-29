"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatNumber, formatWon } from "@/lib/format";
import { BarChart, buildChartData } from "@/components/ProjectPurchaseChartButton";

// 통합 보고서(프로젝트 목록에서 필터된 프로젝트 전부를 합친 보고서) 안의 표들 — 헤더를 누르면 정렬(같은 칸을 다시 누르면
// 오름/내림 전환). 금액 계산은 서버(ProjectsCombinedReport — lib/projectListTotals.ts)에서 해서 넘겨 줌.

type SortDir = "asc" | "desc";
type Value = string | number | null;

// 숫자는 뺄셈, 글자는 가나다순, 빈 값(이익금 없음 등)은 방향과 상관없이 맨 뒤.
function compareValues(a: Value, b: Value, dir: SortDir) {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  const cmp = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "ko");
  return dir === "asc" ? cmp : -cmp;
}

function useSorted<T, K extends string>(rows: T[], valueOf: (r: T, key: K) => Value) {
  const [sortKey, setSortKey] = useState<K | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => compareValues(valueOf(a, sortKey), valueOf(b, sortKey), sortDir));
  }, [rows, sortKey, sortDir, valueOf]);
  function handleSort(key: K) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }
  function headerButton(key: K, label: string) {
    return (
      <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 whitespace-nowrap hover:text-slate-800">
        {label}
        {sortKey === key && <span className="text-[10px] print:hidden">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  }
  return { sorted, headerButton };
}

const textCell = "py-1 pr-3 print:py-0.5";
const numCell = "whitespace-nowrap py-1 pr-3 text-right tabular-nums print:py-0.5";
// 휴대폰에서 긴 글자는 한 줄 말줄임 — 누르면 그 칸만 전체 글자(tap-full). 인쇄는 다 보이게.
const longCell = "tap-full max-md:max-w-[10rem] max-md:truncate print:max-w-none print:overflow-visible print:whitespace-normal";
// 프로젝트별 표는 칸이 많아 숫자만(목록 표와 같게, 제목에 "단위: 원") — PC 1280에서도 남은 금액 칸까지 상자 안에 보이게.
const amount = (v: number | null) => (v === null ? "-" : formatNumber(v));
const rateText = (v: number | null) => (v === null ? "-" : `${v.toFixed(1)}%`);

// ── 프로젝트별(계산 단위별) 표 — 귀속 묶음은 어미 이름 "외 N건" 한 줄(목록의 접힌 요약 줄과 같은 단위) ──
export type CombinedUnitRow = {
  id: string;
  code: string;
  name: string;
  /** 같은 단위로 합친 귀속 하위 수 */
  extraCount: number;
  /** 단위에 든 프로젝트 전부(마우스를 올리면 보임) */
  memberLabels: string;
  site: string;
  status: string;
  quote: number;
  agency: number;
  purchase: number;
  profit: number | null;
  rate: number | null;
  received: number;
  receivable: number | null;
  /** 이 단위의 프로젝트 보고서(묶음이면 합산 보고서) — 닫으면 통합 보고서로 돌아옴 */
  href: string;
};
export type CombinedTotals = Pick<CombinedUnitRow, "quote" | "agency" | "purchase" | "rate" | "received"> & {
  profit: number;
  receivable: number;
};

type UnitKey = "project" | "site" | "status" | "quote" | "agency" | "purchase" | "profit" | "rate" | "received" | "receivable";
const unitValue = (r: CombinedUnitRow, key: UnitKey): Value =>
  key === "project" ? `${r.code} ${r.name}` : r[key];

export function ProjectsCombinedTable({ rows, totals }: { rows: CombinedUnitRow[]; totals: CombinedTotals }) {
  const { sorted, headerButton } = useSorted(rows, unitValue);
  const right = "pb-1 pr-3 text-right";
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full min-w-[880px] text-sm print:min-w-0 print:text-[10px]">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="pb-1 pr-3">{headerButton("project", "프로젝트")}</th>
            <th className="pb-1 pr-3">{headerButton("site", "현장")}</th>
            <th className="pb-1 pr-3">{headerButton("status", "상태")}</th>
            <th className={right}>{headerButton("quote", "발주액")}</th>
            <th className={right}>{headerButton("agency", "대행구매")}</th>
            <th className={right}>{headerButton("purchase", "매입")}</th>
            <th className={right}>{headerButton("profit", "이익금")}</th>
            <th className={right}>{headerButton("rate", "이익율")}</th>
            <th className={right}>{headerButton("received", "받은 금액")}</th>
            <th className="pb-1 text-right">{headerButton("receivable", "남은 금액")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className="border-b border-slate-100 last:border-0">
              <td className={`${textCell} max-w-[16rem] truncate print:max-w-none print:whitespace-normal`} title={r.memberLabels}>
                <Link href={r.href} scroll={false} className="text-slate-900 hover:underline">
                  {r.code && <span className="mr-1 tabular-nums text-xs text-slate-400 print:text-[9px]">{r.code}</span>}
                  {r.name}
                  {r.extraCount > 0 && <span className="ml-1 text-xs text-slate-500 print:text-[9px]">외 {r.extraCount}건</span>}
                </Link>
              </td>
              <td tabIndex={0} className={`${textCell} ${longCell} whitespace-nowrap text-slate-600 md:max-w-[9rem] md:truncate`} title={r.site}>
                {r.site}
              </td>
              <td className={`${textCell} whitespace-nowrap text-slate-600`}>{r.status}</td>
              <td className={`${numCell} text-slate-900`}>{amount(r.quote)}</td>
              <td className={`${numCell} text-slate-500`}>{r.agency ? amount(r.agency) : "-"}</td>
              <td className={`${numCell} text-slate-500`}>{amount(r.purchase)}</td>
              <td className={`${numCell} font-semibold ${r.profit !== null && r.profit < 0 ? "text-red-600" : "text-slate-900"}`}>
                {r.profit === null ? <span className="font-normal text-slate-400">발주액 미입력</span> : amount(r.profit)}
              </td>
              <td className={`${numCell} ${r.rate !== null && r.rate < 0 ? "text-red-600" : "text-slate-700"}`}>{rateText(r.rate)}</td>
              <td className={`${numCell} text-slate-700`}>{r.received ? amount(r.received) : "-"}</td>
              <td className="whitespace-nowrap py-1 text-right tabular-nums text-slate-900 print:py-0.5">{amount(r.receivable)}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={10} className="py-6 text-center text-slate-400">
                프로젝트가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-300 font-semibold text-slate-900">
            <td className={`${textCell} whitespace-nowrap`}>합계 {rows.length}건</td>
            <td />
            <td />
            <td className={numCell}>{amount(totals.quote)}</td>
            <td className={numCell}>{amount(totals.agency)}</td>
            <td className={numCell}>{amount(totals.purchase)}</td>
            <td className={`${numCell} ${totals.profit < 0 ? "text-red-600" : ""}`}>{amount(totals.profit)}</td>
            <td className={numCell}>{rateText(totals.rate)}</td>
            <td className={numCell}>{amount(totals.received)}</td>
            <td className="whitespace-nowrap py-1 text-right tabular-nums print:py-0.5">{amount(totals.receivable)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── 카테고리별 지출(매입 공급가 + 대행구매) — 막대 그래프(발주액 대비)와 표 ──
export type CombinedCategoryRow = { name: string; amount: number; color?: string };

type CategoryKey = "name" | "amount";
const categoryValue = (r: CombinedCategoryRow, key: CategoryKey): Value => r[key];

export function CombinedCategorySection({ rows, quoteTotal }: { rows: CombinedCategoryRow[]; quoteTotal: number }) {
  const { sorted, headerButton } = useSorted(rows, categoryValue);
  const { chartData, chartBase } = buildChartData(rows, quoteTotal);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 print:grid-cols-2 print:break-inside-avoid">
      <div>
        <p className="mb-2 text-xs font-medium text-slate-500 print:text-[9px]">카테고리별 지출 (발주액 대비)</p>
        <BarChart data={chartData} max={chartBase} />
      </div>
      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full text-sm print:text-[10px]">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="pb-1 pr-3">{headerButton("name", "카테고리")}</th>
              <th className="pb-1 pr-3 text-right">{headerButton("amount", "금액")}</th>
              <th className="pb-1 text-right">비율</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr key={c.name} className="border-b border-slate-100 last:border-0">
                <td className={textCell} style={c.name === "미분류" ? { color: "#dc2626" } : { color: c.color }}>
                  {c.name}
                </td>
                <td className={`${numCell} text-slate-900`}>{formatWon(c.amount)}</td>
                <td className="whitespace-nowrap py-1 text-right tabular-nums text-slate-500 print:py-0.5">
                  {total > 0 ? `${((c.amount / total) * 100).toFixed(1)}%` : "-"}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-center text-slate-400">
                  매입 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-semibold text-slate-900">
                <td className={textCell}>합계</td>
                <td className={numCell}>{formatWon(total)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ── 대행구매 내역(여러 프로젝트) — 읽기 전용(추가·수정은 프로젝트 보고서에서) ──
export type CombinedAgencyRow = {
  id: string;
  project: string;
  client: string;
  item: string;
  category: string;
  categoryColor?: string;
  amount: number;
  memo: string;
};

type AgencyKey = "project" | "client" | "item" | "category" | "amount";
const agencyValue = (r: CombinedAgencyRow, key: AgencyKey): Value => r[key];

export function CombinedAgencyTable({ rows }: { rows: CombinedAgencyRow[] }) {
  const { sorted, headerButton } = useSorted(rows, agencyValue);
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="sticky-col-table w-full min-w-[640px] text-sm print:min-w-0 print:text-[10px]">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="pb-1 pr-3">{headerButton("project", "프로젝트")}</th>
            <th className="sticky-col pb-1 pr-3">{headerButton("item", "품목")}</th>
            <th className="pb-1 pr-3">{headerButton("client", "거래처")}</th>
            <th className="pb-1 pr-3">{headerButton("category", "카테고리")}</th>
            <th className="pb-1 pr-3 text-right">{headerButton("amount", "금액")}</th>
            <th className="pb-1">메모</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className="border-b border-slate-100 last:border-0">
              <td tabIndex={0} className={`${textCell} ${longCell} text-slate-700`} title={r.project}>
                {r.project}
              </td>
              <td tabIndex={0} className={`sticky-col ${textCell} ${longCell} text-slate-900`} title={r.item}>
                {r.item}
              </td>
              <td tabIndex={0} className={`${textCell} ${longCell} text-slate-700`} title={r.client}>
                {r.client}
              </td>
              <td
                className={`${textCell} whitespace-nowrap`}
                style={r.category === "미분류" ? { color: "#dc2626" } : { color: r.categoryColor }}
              >
                {r.category}
              </td>
              <td className={`${numCell} text-slate-900`}>{formatWon(r.amount)}</td>
              <td tabIndex={0} className={`py-1 ${longCell} text-slate-500 print:py-0.5`} title={r.memo}>
                {r.memo || "-"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-300 font-semibold text-slate-900">
            <td className={textCell}>합계</td>
            <td className={`sticky-col ${textCell} tabular-nums`}>{rows.length}건</td>
            <td />
            <td />
            <td className={numCell}>{formatWon(rows.reduce((s, r) => s + r.amount, 0))}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
