"use client";

import { downloadCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import type { OutstandingItem } from "@/components/CreditSettlementGroup";
import type { VendorHistoryGroup } from "@/components/CreditHistoryToggle";

export function CreditExportButtons({
  outstandingGroups,
  historyGroups,
}: {
  outstandingGroups: { label: string; items: OutstandingItem[] }[];
  historyGroups: VendorHistoryGroup[];
}) {
  function handleExport() {
    const rows: (string | number)[][] = [
      ["상태", "거래처", "날짜", "프로젝트", "품목", "결제수단", "금액"],
    ];
    for (const g of outstandingGroups) {
      for (const item of g.items) {
        rows.push([
          "미정산",
          g.label,
          formatDate(item.tx.trans_date),
          item.tx.projects?.name ?? "일반경비",
          item.tx.item_name ?? "-",
          "",
          item.remaining,
        ]);
      }
    }
    for (const g of historyGroups) {
      for (const item of g.items) {
        rows.push([
          item.status,
          g.label,
          formatDate(item.trans_date),
          item.project_name ?? "일반경비",
          item.item_name ?? "-",
          item.methodName ?? "",
          item.amount,
        ]);
      }
    }
    downloadCsv(`외상내역_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  return (
    <div className="flex gap-2 print:hidden">
      <Button variant="secondary" size="sm" onClick={() => window.print()}>
        인쇄
      </Button>
      <Button variant="secondary" size="sm" onClick={handleExport}>
        엑셀 다운로드
      </Button>
    </div>
  );
}
