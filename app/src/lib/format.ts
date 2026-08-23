export function formatWon(amount: number | null | undefined) {
  if (amount === null || amount === undefined) return "0원";
  return new Intl.NumberFormat("ko-KR").format(amount) + "원";
}

export function formatDate(date: string | null | undefined) {
  if (!date) return "-";
  return date.slice(0, 10);
}
