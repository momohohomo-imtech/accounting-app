"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BusinessTripLog } from "@/lib/types";
import { createBusinessTripLog } from "@/lib/actions/businessTripLogs";
import { BusinessTripLogForm } from "@/components/BusinessTripLogForm";
import { BusinessTripLogViewPopup } from "@/components/BusinessTripLogViewPopup";
import { BusinessTripBlankFormPopup } from "@/components/BusinessTripBlankFormPopup";
import { ModalPortal } from "@/components/ModalPortal";
import { Button } from "@/components/ui/Button";

type SortKey = "work_date" | "site_name" | "project_name" | "client_name" | "work_types";

function sortValue(log: BusinessTripLog, key: SortKey): string {
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
  }
}

export function BusinessTripListClient({ logs }: { logs: BusinessTripLog[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [blankForm, setBlankForm] = useState(false);
  const [viewing, setViewing] = useState<BusinessTripLog | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

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
      const cmp = sortValue(a, sortKey).localeCompare(sortValue(b, sortKey));
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
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => setCreating(true)}>
          + 새 출장일지 작성
        </Button>
        <Button type="button" variant="secondary" onClick={() => setBlankForm(true)}>
          폼인쇄
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="p-3">{headerButton("work_date", "공사일")}</th>
              <th className="p-3">{headerButton("site_name", "현장명")}</th>
              <th className="p-3">{headerButton("project_name", "프로젝트명")}</th>
              <th className="p-3">{headerButton("client_name", "원청사")}</th>
              <th className="p-3">{headerButton("work_types", "작업구분")}</th>
              <th className="p-3 text-right">관리</th>
            </tr>
          </thead>
          <tbody>
            {sortedLogs.map((log) => (
              <tr key={log.id} className="border-b border-slate-100 last:border-0">
                <td className="p-3 text-slate-700">{log.work_date}</td>
                <td className="p-3 text-slate-700">{log.site_name ?? "-"}</td>
                <td className="p-3 text-slate-700">
                  {log.projects.map((p) => p.project_name).filter(Boolean).join(", ") || "-"}
                </td>
                <td className="p-3 text-slate-700">{log.client_name ?? "-"}</td>
                <td className="p-3 text-slate-700">{log.work_types.join(", ") || "-"}</td>
                <td className="p-3 text-right">
                  <Button type="button" variant="secondary" size="xs" onClick={() => setViewing(log)}>
                    보기
                  </Button>
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">
                  작성된 출장일지가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {creating && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">새 출장일지 작성</h2>
              <BusinessTripLogForm
                action={createBusinessTripLog}
                onSaved={() => {
                  router.refresh();
                  setCreating(false);
                }}
                onCancel={() => setCreating(false)}
              />
            </div>
          </div>
        </ModalPortal>
      )}

      {blankForm && <BusinessTripBlankFormPopup onClose={() => setBlankForm(false)} />}

      {viewing && <BusinessTripLogViewPopup log={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
