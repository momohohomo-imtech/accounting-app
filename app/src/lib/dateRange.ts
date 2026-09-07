// "current"/"all"/"h1"/"h2"/"1".."12" 형태의 월 파라미터를 날짜 범위로 변환.
export function monthRange(selectedYear: number, monthParam: string, currentMonth: number) {
  if (monthParam === "all") return { start: `${selectedYear}-01-01`, end: `${selectedYear}-12-31` };
  if (monthParam === "h1") return { start: `${selectedYear}-01-01`, end: `${selectedYear}-06-30` };
  if (monthParam === "h2") return { start: `${selectedYear}-07-01`, end: `${selectedYear}-12-31` };
  const m = monthParam === "current" ? currentMonth : Number(monthParam);
  const mm = String(m).padStart(2, "0");
  const lastDay = new Date(selectedYear, m, 0).getDate();
  return { start: `${selectedYear}-${mm}-01`, end: `${selectedYear}-${mm}-${String(lastDay).padStart(2, "0")}` };
}
