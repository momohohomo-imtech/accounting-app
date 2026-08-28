"use client";

import { useState } from "react";
import type { BusinessTripLog } from "@/lib/types";
import { BusinessTripLogViewPopup } from "@/components/BusinessTripLogViewPopup";

export function WorkLogDayTripLinks({ logs }: { logs: BusinessTripLog[] }) {
  const [viewing, setViewing] = useState<BusinessTripLog | null>(null);

  if (logs.length === 0) return null;

  return (
    <div className="space-y-1">
      {logs.map((log) => (
        <button
          key={log.id}
          type="button"
          onClick={() => setViewing(log)}
          className="block w-full rounded-lg bg-indigo-50 px-3 py-1.5 text-left text-sm font-medium text-indigo-700 hover:bg-indigo-100"
        >
          *출장일지* {log.site_name ? `— ${log.site_name}` : ""}
        </button>
      ))}
      {viewing && <BusinessTripLogViewPopup log={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
