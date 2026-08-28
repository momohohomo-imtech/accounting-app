"use client";

import { downloadXlsx } from "@/lib/xlsxExport";
import { formatDate } from "@/lib/format";
import { projectStatusLabel } from "@/lib/projectStatus";
import { Button } from "@/components/ui/Button";
import { PrintButton } from "@/components/PrintButton";

type ExportRow = {
  project_code: string | null;
  site_name?: string;
  name: string;
  status: string;
  is_service: boolean;
  start_date: string | null;
  end_date: string | null;
  order_date: string | null;
  quote_amount: number | null;
  contract_amount: number | null;
  contract_amount_estimated: boolean;
  contract_amount_minimum: boolean;
  profit: number | null;
  progress_pct: number | null;
  year: number;
  memo: string | null;
};

export function ProjectListExportButtons({ year, rows }: { year: number; rows: ExportRow[] }) {
  async function handleExport() {
    const data = rows.map((p) => [
      p.project_code ?? "-",
      p.site_name ?? "-",
      p.name,
      projectStatusLabel(p.status),
      p.is_service ? "O" : "",
      formatDate(p.start_date),
      formatDate(p.end_date),
      formatDate(p.order_date),
      p.quote_amount ?? 0,
      p.contract_amount ?? 0,
      p.contract_amount_estimated ? "예상" : p.contract_amount_minimum ? "최소" : "",
      p.profit ?? 0,
      p.progress_pct ?? 0,
      p.year,
      p.memo ?? "",
    ]);
    await downloadXlsx(
      `${year}년_프로젝트현장.xlsx`,
      [
        "프로젝트번호",
        "현장",
        "프로젝트명",
        "상태",
        "무상",
        "시작일",
        "완료일",
        "발주서일자",
        "발주액",
        "수주액",
        "수주액구분",
        "이익금",
        "진행률(%)",
        "연도",
        "메모",
      ],
      data,
      `${year}년 프로젝트`
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
