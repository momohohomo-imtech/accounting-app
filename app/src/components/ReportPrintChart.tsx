"use client";

import { useState } from "react";
import { PieChart, BarChart, REMAINDER_LABEL, type CategoryAmount } from "@/components/ProjectPurchaseChartButton";

export function ReportPrintChart({ data, quoteTotal }: { data: CategoryAmount[]; quoteTotal: number }) {
  const [chartType, setChartType] = useState<"pie" | "bar">("pie");

  const total = data.reduce((s, d) => s + d.amount, 0);
  // 발주액 대비 비중으로 보여주는 방식은 모달 그래프와 동일 — 카테고리 합계가
  // 발주액보다 적으면 나머지를 "잔여" 조각으로 채움.
  const chartBase = quoteTotal > 0 ? quoteTotal : total;
  const remainder = Math.max(0, chartBase - total);
  const chartData = remainder > 0 ? [...data, { name: REMAINDER_LABEL, amount: remainder }] : data;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 print:hidden">
        <p className="text-xs font-medium text-slate-500">인쇄용 그래프</p>
        <div className="flex rounded-lg border border-slate-300 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setChartType("pie")}
            className={`rounded px-2.5 py-1 ${chartType === "pie" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            파이
          </button>
          <button
            type="button"
            onClick={() => setChartType("bar")}
            className={`rounded px-2.5 py-1 ${chartType === "bar" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            막대
          </button>
        </div>
      </div>
      <div className="hidden print:block">
        {chartType === "pie" ? <PieChart data={chartData} total={chartBase} /> : <BarChart data={chartData} max={chartBase} />}
      </div>
    </div>
  );
}
