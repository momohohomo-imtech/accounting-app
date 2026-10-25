"use client";

import { downloadXlsx } from "@/lib/xlsxExport";
import { transactionTotal } from "@/lib/credit";
import { todayString, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { PrintButton } from "@/components/PrintButton";
import { groupLedgerRows, sortGroupLines } from "@/lib/paymentGroup";
import type { Transaction } from "@/lib/types";

export function TransactionExportButtons({ transactions }: { transactions: Transaction[] }) {
  async function handleExport() {
    // 한 결제로 묶인 거래(092)는 화면처럼 한 줄로 — 거래처·프로젝트·품목은 이름을 모두 적고 금액은 합계.
    const rows = groupLedgerRows(transactions).map((item) => {
      const lines = sortGroupLines(item.lines);
      const t = lines[0];
      const names = (pick: (l: Transaction) => string) => Array.from(new Set(lines.map(pick))).join(", ");
      return [
        formatDate(t.trans_date),
        t.type,
        names((l) => l.clients?.name ?? l.client_name_raw ?? "-"),
        names((l) => l.projects?.name ?? "일반경비"),
        names((l) => l.item_name ?? "-"),
        t.payment_methods?.name ?? "-",
        lines.some((l) => l.tax_invoice_issued) ? "발행" : "-",
        lines.reduce((s, l) => s + transactionTotal(l), 0),
      ];
    });
    await downloadXlsx(
      `매입매출_${todayString()}.xlsx`,
      ["날짜", "구분", "거래처", "프로젝트", "품목", "결제방식", "세금계산서", "금액"],
      rows,
      "매입매출"
    );
  }

  return (
    <div className="flex gap-2 print:hidden">
      <PrintButton />
      <Button variant="secondary" size="sm" onClick={handleExport}>
        엑셀 다운로드
      </Button>
    </div>
  );
}
