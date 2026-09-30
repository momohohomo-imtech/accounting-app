import { downloadXlsx } from "@/lib/xlsxExport";
import { tripProjectLabel, tripTotals, type TripProjectDoc } from "@/lib/tripLog";

// 출장일지(새 방식) 엑셀 — 머리 정보·합계 줄 아래에 날짜별 표.
export function downloadTripLogXlsx(doc: TripProjectDoc) {
  const t = tripTotals(doc.days);
  const period = t.from ? (t.from === t.to ? t.from : `${t.from} ~ ${t.to}`) : "-";
  const leadingRows: (string | number)[][] = [
    ["출장 업무 내역서"],
    ["프로젝트", tripProjectLabel(doc)],
    ["현장", doc.siteName ?? "-", "원청사", doc.clientName ?? "-"],
    ["기간", period, "작업구분", doc.workTypes.join(", ") || "-"],
    ["총 일수", `${t.days}일`, "총 투입 인원", `${t.people}명`, "사내", `${t.staff}명`, "조공", `${t.helper}명`],
    ["비고", doc.note || "-"],
    [],
  ];
  const rows: (string | number)[][] = doc.days.map((d) => [
    d.work_date,
    d.contents,
    d.staff_count,
    d.helper_count,
    d.staff_count + d.helper_count,
    d.equipment_used ? "O" : "",
    d.equipment_place ?? "",
    d.equipment_hours ?? "",
    d.note ?? "",
  ]);
  rows.push(["합계", "", t.staff, t.helper, t.people, t.equipmentDays ? `${t.equipmentDays}일` : "", "", "", ""]);
  const safeName = tripProjectLabel(doc).replace(/[\\/:*?"<>|]/g, "_");
  return downloadXlsx(
    `출장일지_${safeName}.xlsx`,
    ["날짜", "작업 내용", "사내", "조공", "계", "장비 투입", "사용처", "시간", "비고"],
    rows,
    "출장일지",
    leadingRows
  );
}
