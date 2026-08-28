"use client";

import { useEffect, useState } from "react";
import { getSiteWorkLogDetail, type SiteWorkLogDetail } from "@/lib/actions/worklogs";
import { parseMonthRange } from "@/lib/monthRange";
import { fieldClass } from "@/components/ui/field";
import { Button } from "@/components/ui/Button";

function formatMonthDay(dateKey: string) {
  const [, m, d] = dateKey.split("-");
  return `${Number(m)}월${Number(d)}일`;
}

export function SiteAggregatePopup({
  siteId,
  siteName,
  siteColor,
  initialYear,
  onClose,
}: {
  siteId: string;
  siteName: string;
  siteColor: string;
  initialYear: number;
  onClose: () => void;
}) {
  const [year, setYear] = useState(initialYear);
  const [monthInput, setMonthInput] = useState("1-12");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<SiteWorkLogDetail | null>(null);

  async function load(y: number, monthRange: string) {
    setLoading(true);
    const { start, end } = parseMonthRange(monthRange);
    const result = await getSiteWorkLogDetail(y, siteId, start, end);
    setDetail(result);
    setLoading(false);
  }

  useEffect(() => {
    load(initialYear, "1-12");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm text-slate-500">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: siteColor }} />
              {siteName}
            </p>
            {detail && (
              <p className="mt-1 text-sm text-slate-700">
                작업 종류 <span className="font-semibold">{detail.jobTypeCount}</span>개 · 총{" "}
                <span className="font-semibold">{detail.dayCount}</span>일
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">
            닫기
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2 border-y border-slate-100 py-3">
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className={`${fieldClass} w-24`}
          />
          <input
            value={monthInput}
            onChange={(e) => setMonthInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(year, monthInput)}
            placeholder="예: 3 또는 1-8"
            className={`${fieldClass} w-24`}
          />
          <Button type="button" size="sm" disabled={loading} onClick={() => load(year, monthInput)}>
            조회
          </Button>
        </div>

        {loading || !detail ? (
          <p className="py-8 text-center text-sm text-slate-400">불러오는 중...</p>
        ) : (
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {detail.entries.map((e, i) => (
              <div
                key={`${e.log_date}-${i}`}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-1.5 text-sm"
              >
                <span className="shrink-0 font-medium text-slate-900">{formatMonthDay(e.log_date)}</span>
                <span className="truncate pl-3 text-slate-600">{e.title}</span>
              </div>
            ))}
            {detail.entries.length === 0 && <p className="py-8 text-center text-sm text-slate-400">내역이 없습니다.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
