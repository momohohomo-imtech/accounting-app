"use client";

import { PieChart, BarChart, REMAINDER_LABEL, type CategoryAmount } from "@/components/ProjectPurchaseChartButton";
import { useChartType } from "@/components/ReportChartProvider";

export function ReportPrintChart({ data, quoteTotal }: { data: CategoryAmount[]; quoteTotal: number }) {
  const { chartType } = useChartType();

  const total = data.reduce((s, d) => s + d.amount, 0);
  // 발주액 대비 비중으로 보여주는 방식은 모달 그래프와 동일 — 카테고리 합계가
  // 발주액보다 적으면 나머지를 "잔여" 조각으로 채움.
  const chartBase = quoteTotal > 0 ? quoteTotal : total;
  const remainder = Math.max(0, chartBase - total);
  const chartData = remainder > 0 ? [...data, { name: REMAINDER_LABEL, amount: remainder }] : data;

  return (
    <div className="hidden print:block">
      {chartType === "pie" ? <PieChart data={chartData} total={chartBase} /> : <BarChart data={chartData} max={chartBase} />}
    </div>
  );
}
