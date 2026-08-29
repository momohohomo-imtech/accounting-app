"use client";

import { downloadXlsx } from "@/lib/xlsxExport";
import { transactionTotal } from "@/lib/credit";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { PrintButton } from "@/components/PrintButton";
import type { Transaction } from "@/lib/types";

export function TransactionExportButtons({ transactions }: { transactions: Transaction[] }) {
  async function handleExport() {
    const rows = transactions.map((t) => [
      formatDate(t.trans_date),
      t.type,
      t.clients?.name ?? t.client_name_raw ?? "-",
      t.projects?.name ?? "일반경비",
      t.item_name ?? "-",
      t.payment_methods?.name ?? "-",
      t.tax_invoice_issued ? "발행" : "-",
      transactionTotal(t),
    ]);
    const rowFillArgb = transactions.map((t) => (t.expense_categories?.name === "출장" ? "FFDCFCE7" : null));
    await downloadXlsx(
      `매입매출_${new Date().toISOString().slice(0, 10)}.xlsx`,
      ["날짜", "구분", "거래처", "프로젝트", "품목", "결제방식", "세금계산서", "금액"],
      rows,
      "매입매출",
      [],
      rowFillArgb
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
