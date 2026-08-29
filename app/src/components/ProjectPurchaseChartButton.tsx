"use client";

import { useEffect, useState } from "react";
import { formatWon } from "@/lib/format";
import { autoSiteColorHex } from "@/lib/siteColor";
import { ModalPortal } from "@/components/ModalPortal";

type CategoryAmount = { name: string; amount: number };

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

function PieChart({ data, total }: { data: CategoryAmount[]; total: number }) {
  const size = 220;
  const r = 90;
  const cx = size / 2;
  const cy = size / 2;

  let cursor = 0;
  const slices = data.map((d) => {
    const pct = total > 0 ? d.amount / total : 0;
    const startAngle = cursor * 360;
    cursor += pct;
    const endAngle = cursor * 360;
    return { ...d, pct, startAngle, endAngle };
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="shrink-0">
        {slices.length === 1 ? (
          <circle cx={cx} cy={cy} r={r} fill={autoSiteColorHex(slices[0].name)} />
        ) : (
          slices.map((s) => (
            <path key={s.name} d={arcPath(cx, cy, r, s.startAngle, s.endAngle)} fill={autoSiteColorHex(s.name)} />
          ))
        )}
        {data.length === 0 && <circle cx={cx} cy={cy} r={r} fill="#e2e8f0" />}
      </svg>
      <div className="min-w-0 flex-1 space-y-1.5">
        {slices.map((s) => (
          <div key={s.name} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: autoSiteColorHex(s.name) }} />
            <span className="min-w-0 flex-1 truncate text-slate-700">{s.name}</span>
            <span className="shrink-0 font-mono text-xs text-slate-500">{(s.pct * 100).toFixed(1)}%</span>
            <span className="shrink-0 font-mono font-semibold text-slate-900">{formatWon(s.amount)}</span>
          </div>
        ))}
        {data.length === 0 && <p className="text-sm text-slate-400">매입 내역이 없습니다.</p>}
      </div>
    </div>
  );
}

function BarChart({ data }: { data: CategoryAmount[] }) {
  const max = Math.max(1, ...data.map((d) => d.amount));
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.name} className="flex items-center gap-2">
          <span className="w-24 shrink-0 truncate text-sm text-slate-700" title={d.name}>
            {d.name}
          </span>
          <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
            <div
              className="h-full rounded"
              style={{ width: `${(d.amount / max) * 100}%`, backgroundColor: autoSiteColorHex(d.name) }}
            />
          </div>
          <span className="w-24 shrink-0 text-right font-mono text-sm font-semibold text-slate-900">
            {formatWon(d.amount)}
          </span>
        </div>
      ))}
      {data.length === 0 && <p className="text-sm text-slate-400">매입 내역이 없습니다.</p>}
    </div>
  );
}

export function ProjectPurchaseChartButton({ data, title }: { data: CategoryAmount[]; title: string }) {
  const [open, setOpen] = useState(false);
  const [chartType, setChartType] = useState<"pie" | "bar">("pie");

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const total = data.reduce((s, d) => s + d.amount, 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="매입 카테고리별 그래프"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
      >
        <svg viewBox="0 0 20 20" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.6}>
          <circle cx="10" cy="10" r="8" />
          <path d="M10 2 A8 8 0 0 1 17 12 L10 10 Z" fill="currentColor" stroke="none" />
        </svg>
      </button>

      {open && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10"
            onClick={() => setOpen(false)}
          >
            <div
              className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-900">{title} — 매입 카테고리별</h3>
                  <p className="text-xs text-slate-400">매입 합계 {formatWon(total)}</p>
                </div>
                <div className="flex items-center gap-2">
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
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="text-sm text-slate-500 hover:text-slate-800"
                  >
                    닫기
                  </button>
                </div>
              </div>

              {chartType === "pie" ? <PieChart data={data} total={total} /> : <BarChart data={data} />}
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
