"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type ChartType = "pie" | "bar";
type ChartCtx = { chartType: ChartType; setChartType: (t: ChartType) => void };

const ChartContext = createContext<ChartCtx | null>(null);

export function useChartType() {
  const ctx = useContext(ChartContext);
  if (!ctx) throw new Error("useChartType must be used within ReportChartProvider");
  return ctx;
}

export function ReportChartProvider({ children }: { children: ReactNode }) {
  const [chartType, setChartType] = useState<ChartType>("pie");
  return <ChartContext.Provider value={{ chartType, setChartType }}>{children}</ChartContext.Provider>;
}
