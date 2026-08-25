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
