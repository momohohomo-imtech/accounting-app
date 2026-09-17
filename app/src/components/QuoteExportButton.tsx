"use client";

import { downloadXlsx } from "@/lib/xlsxExport";
import { formatDate, formatWon } from "@/lib/format";
import { numberToKoreanAmount } from "@/lib/numberToKorean";
import { Button } from "@/components/ui/Button";
import type { QuoteCompanyInfo } from "@/lib/actions/quotes";

type Row = {
  id: string;
  item_name: string | null;
  spec: string | null;
  unit: string | null;
  quantity: number | null;
  note: string | null;
  adjustedUnitPrice: number | null;
  confirmed: number;
};

export function QuoteExportButton({
  quote,
  companyInfo,
  rows,
  total,
}: {
  quote: {
    quote_number: string | null;
    title: string;
    clientName: string | null;
    valid_until: string | null;
    memo: string | null;
    created_at: string;
  };
  companyInfo: QuoteCompanyInfo;
  rows: Row[];
  total: number;
}) {
  async function handleExport() {
    const leadingRows: (string | number)[][] = [
      [`견적서 ${quote.quote_number ?? ""}`],
      [
        `공사명: ${quote.title}`,
        `거래처: ${quote.clientName ?? "-"}`,
        `견적일자: ${formatDate(quote.created_at)}`,
        `유효기한: ${quote.valid_until ? formatDate(quote.valid_until) : "-"}`,
      ],
      [
        `공급자: ${companyInfo.companyName || "-"}${companyInfo.representativeName ? ` (대표 ${companyInfo.representativeName})` : ""}`,
        `사업자등록번호: ${companyInfo.bizRegNo || "-"}`,
        `주소: ${companyInfo.address || "-"}`,
        `업태/종목: ${companyInfo.bizType || "-"} / ${companyInfo.bizItem || "-"}`,
        `전화/팩스: ${companyInfo.phone || "-"} / ${companyInfo.fax || "-"}`,
      ],
      [`합계금액 (VAT 별도): ${numberToKoreanAmount(total)} (${formatWon(total)})`],
    ];
    const data: (string | number)[][] = rows.map((r, i) => [
      i + 1,
      r.item_name ?? "-",
      r.spec ?? "-",
      r.unit ?? "-",
      r.quantity ?? "-",
      r.adjustedUnitPrice ?? "-",
      r.confirmed,
      r.note ?? "-",
    ]);
    data.push(["", "", "", "", "", "합계", total, ""]);
    if (quote.memo) data.push([`비고: ${quote.memo}`]);

    await downloadXlsx(
      `견적서_${quote.quote_number ?? quote.title}.xlsx`,
      ["No", "품명", "규격", "단위", "수량", "단가", "금액", "비고"],
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
