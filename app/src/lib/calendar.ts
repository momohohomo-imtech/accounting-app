export type MonthCell = {
  dateKey: string;
  day: number;
  inMonth: boolean;
  weekday: number;
};

export const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function buildMonthGrid(year: number, month: number): MonthCell[][] {
  const first = new Date(year, month - 1, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

  const cells: MonthCell[] = Array.from({ length: totalCells }, (_, i) => {
    const d = new Date(year, month - 1, 1 - startWeekday + i);
    return {
      dateKey: toDateKey(d),
      day: d.getDate(),
      inMonth: d.getMonth() === month - 1,
      weekday: d.getDay(),
    };
  });

  const weeks: MonthCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
