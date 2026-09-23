"use client";

import { useMemo, useState } from "react";
import { formatWon, formatDate } from "@/lib/format";
import { projectStatusLabel, PROJECT_STATUS_AWAITING_PAYMENT } from "@/lib/projectStatus";
import { BarChart, buildChartData, type CategoryAmount } from "@/components/ProjectPurchaseChartButton";
import { Badge } from "@/components/ui/Badge";
import { fieldClass } from "@/components/ui/field";
import { ProjectSummaryMemoEditor } from "@/components/ProjectSummaryMemoEditor";

export type ProjectSummaryRow = {
  id: string;
  projectCode: string | null;
  name: string;
  siteName: string | null;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  orderDate: string | null;
  memo: string | null;
  /** 작업일지 기준 실제 작업한 날짜 수(귀속 하위 프로젝트 포함, 중복 날짜는 한 번만). */
  workDayCount: number;
  /** 이 프로젝트에 귀속(합산)된 하위 프로젝트 이름들 — 있으면 재무제표에 이미 합산돼 있음을 표시. */
  childNames: string[];
  quoteAmount: number;
  agencyAmount: number;
  purchaseTotal: number;
  purchaseSupply: number;
  purchaseVat: number;
  contractAmountExpected: number;
  profit: number;
  margin: number | null;
  categoryBreakdown: (CategoryAmount & { color?: string })[];
};

// 공사완료·완료 수금대기·수금완료 프로젝트를 A4 한 장짜리 재무제표 형태로 나열 —
// 매입 품목 전체 내역이 아니라 카테고리별 합산 금액만 보여주는 요약본. 귀속(하위)
// 프로젝트는 이미 어미 프로젝트 카드에 합산돼 있으므로 여기 목록에는 따로 나오지
// 않는다. "전체 → 현장 → 프로젝트" 순으로 좁혀가는 드롭다운 2개로 화면·인쇄에 남길
// 범위를 고르고, 인쇄 시엔 해당 범위끼리만 마지막 항목 제외 print:break-after-page로
// 페이지를 나눈다.
export function ProjectSummaryReport({ rows }: { rows: ProjectSummaryRow[] }) {
  const [selectedSite, setSelectedSite] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const siteOptions = useMemo(
    () => Array.from(new Set(rows.map((p) => p.siteName).filter((s): s is string => Boolean(s)))).sort((a, b) => a.localeCompare(b, "ko")),
    [rows]
  );

  const projectOptionsForSite = useMemo(
    () =>
      rows
        .filter((p) => !selectedSite || p.siteName === selectedSite)
        .map((p) => ({ id: p.id, label: p.projectCode ? `${p.projectCode} ${p.name}` : p.name }))
        .sort((a, b) => a.label.localeCompare(b.label, "ko")),
    [rows, selectedSite]
  );

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        공사완료·완료 수금대기·수금완료 상태의 프로젝트가 없습니다.
      </p>
    );
  }

  const visibleRows = rows.filter(
    (p) => (!selectedSite || p.siteName === selectedSite) && (!selectedProjectId || p.id === selectedProjectId)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 print:hidden">
        <span className="text-xs font-medium text-slate-500">범위 선택 ({visibleRows.length}/{rows.length}건)</span>
        <select
          value={selectedSite}
          onChange={(e) => {
            setSelectedSite(e.target.value);
            setSelectedProjectId("");
          }}
          className={`${fieldClass} w-auto`}
        >
          <option value="">전체 현장</option>
          {siteOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className={`${fieldClass} w-auto`}
        >
          <option value="">전체 프로젝트</option>
          {projectOptionsForSite.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-6 print:space-y-0">
        {visibleRows.map((p, i) => {
          const { chartData, chartBase } = buildChartData(p.categoryBreakdown, p.quoteAmount);
          return (
            <div
              key={p.id}
              className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:break-inside-avoid print:rounded-none print:border-0 print:border-b-2 print:border-slate-400 print:p-3 print:pb-6 print:shadow-none ${
                i < visibleRows.length - 1 ? "print:break-after-page" : ""
              }`}
            >
              <div className="mb-3 border-b border-slate-100 pb-3 print:pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-xs text-slate-400 print:text-[10px]">{p.projectCode ?? "-"}</p>
                  {p.status === PROJECT_STATUS_AWAITING_PAYMENT && (
                    <Badge variant="red" className="print:border print:border-red-600 print:bg-white">
                      미수금 {formatWon(p.contractAmountExpected)}
                    </Badge>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 print:text-base">
                  {p.name}
                  <span className="ml-2 font-normal text-slate-500">작업일수: {p.workDayCount}일</span>
                  {p.childNames.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-slate-400 print:text-[9px]">
                      (귀속 합산: {p.childNames.join(", ")})
                    </span>
                  )}
                </h3>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500 print:text-[10px]">
                  <span>현장: {p.siteName ?? "-"}</span>
                  <span>상태: {projectStatusLabel(p.status)}</span>
                  <span>
                    기간: {formatDate(p.startDate)} ~ {formatDate(p.endDate)}
                  </span>
                  <span>발주서일자: {formatDate(p.orderDate)}</span>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 print:mb-3 print:grid-cols-4 print:gap-2 print:break-inside-avoid">
                <div>
                  <p className="text-xs text-slate-500 print:text-[9px]">발주액</p>
                  <p className="font-mono text-sm font-bold whitespace-nowrap text-slate-900 print:text-xs">
                    {formatWon(p.quoteAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 print:text-[9px]">대행구매액</p>
                  <p className="font-mono text-sm font-bold whitespace-nowrap text-slate-500 print:text-xs">
                    -{formatWon(p.agencyAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 print:text-[9px]">매입 공급가액</p>
                  <p className="font-mono text-sm font-bold whitespace-nowrap text-slate-500 print:text-xs">
                    -{formatWon(p.purchaseSupply)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 print:text-[9px]">매입 부가세</p>
                  <p className="font-mono text-sm font-bold whitespace-nowrap text-slate-500 print:text-xs">
                    -{formatWon(p.purchaseVat)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 print:text-[9px]">매입 합계</p>
                  <p className="font-mono text-sm font-bold whitespace-nowrap text-slate-500 print:text-xs">
                    -{formatWon(p.purchaseTotal)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 print:text-[9px]">수주예상액</p>
                  <p className="font-mono text-sm font-bold whitespace-nowrap text-slate-900 print:text-xs">
                    {formatWon(p.contractAmountExpected)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 print:text-[9px]">이익금</p>
                  <p
                    className={`font-mono text-sm font-bold whitespace-nowrap print:text-xs ${p.profit >= 0 ? "text-slate-900" : "text-red-600"}`}
                  >
                    {formatWon(p.profit)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 print:text-[9px]">이익율</p>
                  <p
                    className={`font-mono text-sm font-bold whitespace-nowrap print:text-xs ${p.margin === null || p.margin >= 0 ? "text-slate-900" : "text-red-600"}`}
                  >
                    {p.margin === null ? "-" : `${p.margin.toFixed(2)}%`}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 print:grid-cols-2 print:gap-4 print:break-inside-avoid">
                <div>
                  <p className="mb-2 text-xs font-medium text-slate-500 print:text-[9px]">카테고리별 지출 (발주액 대비)</p>
                  <BarChart data={chartData} max={chartBase} />
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-slate-500 print:text-[9px]">카테고리별 합산 지출 내역</p>
                  <table className="w-full text-sm print:text-[10px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-500">
                        <th className="pb-1 pr-2 print:pb-0.5">카테고리</th>
                        <th className="pb-1 text-right print:pb-0.5">금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.categoryBreakdown.map((c) => (
                        <tr key={c.name} className="border-b border-slate-100 last:border-0">
                          <td
                            className="py-1 pr-2 print:py-0.5"
                            style={c.name === "미분류" ? { color: "#dc2626" } : { color: c.color }}
                          >
                            {c.name}
                          </td>
                          <td className="py-1 text-right font-mono text-slate-900 print:py-0.5">{formatWon(c.amount)}</td>
                        </tr>
                      ))}
                      {p.categoryBreakdown.length === 0 && (
                        <tr>
                          <td colSpan={2} className="py-4 text-center text-slate-400">
                            매입 내역이 없습니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <ProjectSummaryMemoEditor projectId={p.id} initialMemo={p.memo} />
            </div>
          );
        })}
        {visibleRows.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">선택된 프로젝트가 없습니다.</p>
        )}
      </div>
    </div>
  );
}
