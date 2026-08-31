"use client";

import { downloadXlsx } from "@/lib/xlsxExport";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/Button";

type Row = {
  id: string;
  item_name: string | null;
  spec: string | null;
  quantity: number | null;
  note: string | null;
  adjustedUnitPrice: number | null;
  confirmed: number;
};

export function QuoteExportButton({
  quote,
  rows,
  total,
}: {
  quote: { quote_number: string | null; title: string; clientName: string | null; created_at: string };
  rows: Row[];
  total: number;
}) {
  async function handleExport() {
    const leadingRows: (string | number)[][] = [
      [`견적서 ${quote.quote_number ?? ""}`],
      [`건명: ${quote.title}`, `거래처: ${quote.clientName ?? "-"}`, `견적일자: ${formatDate(quote.created_at)}`],
    ];
    const data: (string | number)[][] = rows.map((r, i) => [
      i + 1,
      r.item_name ?? "-",
      r.spec ?? "-",
      r.quantity ?? "-",
      r.adjustedUnitPrice ?? "-",
      r.confirmed,
      r.note ?? "-",
    ]);
    data.push(["", "", "", "", "합계", total, ""]);

    await downloadXlsx(
      `견적서_${quote.quote_number ?? quote.title}.xlsx`,
      ["No", "품명", "규격", "수량", "단가", "금액", "비고"],
      data,
      "견적서",
      leadingRows
    );
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleExport} className="print:hidden">
      엑셀 다운로드
    </Button>
  );
}
