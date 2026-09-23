"use client";

import { PieChart, BarChart, buildChartData, type CategoryAmount } from "@/components/ProjectPurchaseChartButton";
import { useChartType } from "@/components/ReportChartProvider";

export function ReportPrintChart({ data, quoteTotal }: { data: CategoryAmount[]; quoteTotal: number }) {
  const { chartType } = useChartType();

  // 발주액 대비 비중으로 보여주는 방식은 모달 그래프와 동일 — 카테고리 합계가 발주액보다
  // 적으면 이윤+잡비(25%) 몫을 먼저 채우고, 그래도 남으면 "잔여" 조각으로 채움.
  const { chartData, chartBase } = buildChartData(data, quoteTotal);

  return (
    <div className="hidden print:block">
      {chartType === "pie" ? <PieChart data={chartData} total={chartBase} /> : <BarChart data={chartData} max={chartBase} />}
    </div>
  );
}
