import { downloadXlsx } from "@/lib/xlsxExport";
import { countLabel, formatTripPeriod, tripProjectLabel, tripTotals, workDaySplit, type TripProjectDoc } from "@/lib/tripLog";

// 출장일지(새 방식) 엑셀 — 머리 정보·합계 줄 아래에 날짜별 표. 화면(TripLogPopup)과 같이 0·없는 값은 공란.
export function downloadTripLogXlsx(doc: TripProjectDoc) {
  const t = tripTotals(doc.days);
  const inhouse = workDaySplit(doc.workDates, doc.days.map((d) => d.work_date)).inhouse;
  const count = (n: number) => (n > 0 ? n : "");
  const leadingRows: (string | number)[][] = [
    ["출장 업무 내역서"],
    ["프로젝트", tripProjectLabel(doc)],
    ["현장", doc.siteName ?? "", "원청사", doc.clientName ?? ""],
    ["기간", formatTripPeriod(t), "작업구분", doc.workTypes.join(", ")],
    [
      "출장 일수",
      countLabel(t.days, "일"),
      "내근 일수",
      inhouse ? `${inhouse}일 (${doc.periodLabel} 작업일지 기준)` : "",
    ],
    ["총 투입 인원", countLabel(t.people, "명"), "사내", countLabel(t.staff, "명"), "조공", countLabel(t.helper, "명")],
    ["비고", doc.note],
    [],
  ];
  const rows: (string | number)[][] = doc.days.map((d) => [
    d.work_date,
    d.contents,
    count(d.staff_count),
    count(d.helper_count),
    count(d.staff_count + d.helper_count),
    d.equipment_used ? "O" : "",
    d.equipment_place ?? "",
    d.equipment_hours ?? "",
    d.note ?? "",
  ]);
  rows.push(["합계", countLabel(t.days, "일"), count(t.staff), count(t.helper), count(t.people), countLabel(t.equipmentDays, "일"), "", "", ""]);
  const safeName = tripProjectLabel(doc).replace(/[\\/:*?"<>|]/g, "_");
  return downloadXlsx(
    `출장일지_${safeName}.xlsx`,
    ["날짜", "작업 내용", "사내", "조공", "계", "장비 투입", "사용처", "시간", "비고"],
    rows,
    "출장일지",
    leadingRows
  );
}
