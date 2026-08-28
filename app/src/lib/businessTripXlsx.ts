import ExcelJS from "exceljs";
import type { BusinessTripLog } from "@/lib/types";

function triggerDownload(buffer: ExcelJS.Buffer, filename: string) {
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadBusinessTripLogXlsx(log: BusinessTripLog) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("출장업무내역서");

  const title = ws.addRow(["출장 업무 내역서"]);
  title.font = { bold: true, size: 16 };
  ws.addRow([]);

  ws.addRow(["원청사", log.client_name ?? "", "현장명", log.site_name ?? ""]);
  ws.addRow(["작성일", log.created_date, "공사일", log.work_date]);
  ws.addRow(["작업구분", log.work_types.join(", ")]);
  ws.addRow(["비고", log.note ?? ""]);

  for (const p of log.projects) {
    ws.addRow([]);
    ws.addRow([`프로젝트: ${p.project_name || "-"}`]).font = { bold: true };

    ws.addRow(["작업 인원 내역"]).font = { bold: true };
    const workerHeader = ws.addRow(["작업자명", "근무일", "추가근무", "비고"]);
    workerHeader.font = { bold: true };
    for (const w of p.workers) {
      ws.addRow([w.name, w.work_date, w.overtime ? "O" : "", w.note]);
    }
    ws.addRow(["총 공수", `${p.total_manpower || ""}명`]);
    ws.addRow([]);

    ws.addRow(["장비 사용 내역"]).font = { bold: true };
    const eqHeader = ws.addRow(["장비명", "사용처", "작업시간", "비고"]);
    eqHeader.font = { bold: true };
    for (const e of p.equipment) {
      ws.addRow([e.name, e.location, e.hours, e.note]);
    }
    ws.addRow([]);

    ws.addRow(["현장 지출 내역"]).font = { bold: true };
    const expHeader = ws.addRow(["사용처", "금액", "비고"]);
    expHeader.font = { bold: true };
    for (const e of p.expenses) {
      ws.addRow([e.vendor, e.amount, e.note]);
    }
  }

  ws.columns.forEach((c) => {
    c.width = 20;
  });

  triggerDownload(await wb.xlsx.writeBuffer(), `출장업무내역서_${log.work_date}.xlsx`);
}
