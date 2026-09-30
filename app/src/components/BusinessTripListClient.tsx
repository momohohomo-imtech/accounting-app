"use client";

import { useMemo, useState } from "react";
import type { BusinessTripLog } from "@/lib/types";
import { tripDayCount } from "@/lib/businessTrip";
import { BusinessTripLogViewPopup } from "@/components/BusinessTripLogViewPopup";
import { Button } from "@/components/ui/Button";
import { useEscapeKey } from "@/lib/useEscapeKey";

type SortKey = "work_date" | "site_name" | "project_name" | "client_name" | "work_types" | "day_count";

function sortValue(log: BusinessTripLog, key: SortKey): string | number {
  switch (key) {
    case "work_date":
      return log.work_date;
    case "site_name":
      return log.site_name ?? "";
    case "project_name":
      return log.projects.map((p) => p.project_name).filter(Boolean).join(", ");
    case "client_name":
      return log.client_name ?? "";
    case "work_types":
      return log.work_types.join(", ");
    case "day_count":
      return tripDayCount(log);
  }
}

// 예전 방식 출장일지(090 이전, business_trip_logs) — 새 출장일지는 TripLogList. 여기서는 보기·인쇄·엑셀·삭제만.
export function BusinessTripListClient({ logs }: { logs: BusinessTripLog[] }) {
  const [viewing, setViewing] = useState<BusinessTripLog | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  useEscapeKey(Boolean(viewing), () => setViewing(null));

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedLogs = useMemo(() => {
    if (!sortKey) return logs;
    const copy = [...logs];
    copy.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [logs, sortKey, sortDir]);

  function headerButton(key: SortKey, label: string) {
    return (
      <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 hover:text-slate-800">
        {label}
        {sortKey === key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="sticky-col-table w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="p-3">{headerButton("work_date", "공사일")}</th>
              <th className="sticky-col p-3">{headerButton("site_name", "현장명")}</th>
              <th className="p-3">{headerButton("project_name", "프로젝트명")}</th>
              <th className="p-3">{headerButton("client_name", "원청사")}</th>
              <th className="p-3">{headerButton("work_types", "작업구분")}</th>
              <th className="p-3 text-right">{headerButton("day_count", "공사일수")}</th>
              <th className="p-3 text-right">관리</th>
            </tr>
          </thead>
          <tbody>
            {sortedLogs.map((log) => (
              <tr key={log.id} className="border-b border-slate-100 last:border-0">
                <td className="p-3 text-slate-700">{log.work_date}</td>
                <td className="sticky-col p-3 text-slate-700">{log.site_name ?? "-"}</td>
                <td className="p-3 text-slate-700">
                  {log.projects.map((p) => p.project_name).filter(Boolean).join(", ") || "-"}
                </td>
                <td className="p-3 text-slate-700">{log.client_name ?? "-"}</td>
                <td className="p-3 text-slate-700">{log.work_types.join(", ") || "-"}</td>
                <td className="p-3 text-right tabular-nums text-slate-900">{tripDayCount(log)}일</td>
                <td className="p-3 text-right">
                  <Button type="button" variant="secondary" size="xs" onClick={() => setViewing(log)}>
                    보기
                  </Button>
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">
                  작성된 출장일지가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {viewing && <BusinessTripLogViewPopup log={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
