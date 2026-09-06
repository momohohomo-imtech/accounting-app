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

// new Date().toISOString().slice(0, 10)는 UTC 기준이라, 한국 시간 자정~오전 9시
// 사이에는 하루 전 날짜가 나오는 버그가 있음 — 로컬 타임존 기준으로 오늘 날짜를 구함.
export function todayString() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function formatFileSize(bytes: number | null | undefined) {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
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
