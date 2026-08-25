export function formatWon(amount: number | null | undefined) {
  if (amount === null || amount === undefined) return "0원";
  return new Intl.NumberFormat("ko-KR").format(amount) + "원";
}

export function formatNumber(amount: number | string | null | undefined) {
  if (amount === null || amount === undefined || amount === "") return "-";
  return new Intl.NumberFormat("ko-KR").format(Number(amount));
}

export function formatDate(date: string | null | undefined) {
  if (!date) return "-";
  return date.slice(0, 10);
}

/** Sorts by employee_no ascending (numeric-aware); entries without a numeric employee_no go last. */
export function sortByEmployeeNo<T extends { employee_no: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const na = Number(a.employee_no);
    const nb = Number(b.employee_no);
    const aValid = a.employee_no !== null && a.employee_no !== "" && !Number.isNaN(na);
    const bValid = b.employee_no !== null && b.employee_no !== "" && !Number.isNaN(nb);
    if (aValid && bValid) return na - nb;
    if (aValid) return -1;
    if (bValid) return 1;
    return 0;
  });
}
