"use client";

import { useChartType } from "@/components/ReportChartProvider";

export function ReportChartToggle() {
  const { chartType, setChartType } = useChartType();

  return (
    <div className="flex items-center gap-1.5 print:hidden">
      <p className="text-xs text-slate-500">인쇄용 그래프</p>
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
  );
}
