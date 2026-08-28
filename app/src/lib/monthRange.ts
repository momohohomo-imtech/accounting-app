export function parseMonthRange(input: string | undefined): { start: number; end: number; label: string } {
  const raw = (input ?? "1-12").trim();
  const rangeMatch = raw.match(/^(\d{1,2})-(\d{1,2})$/);
  if (rangeMatch) {
    const a = Math.min(12, Math.max(1, Number(rangeMatch[1])));
    const b = Math.min(12, Math.max(1, Number(rangeMatch[2])));
    const start = Math.min(a, b);
    const end = Math.max(a, b);
    return { start, end, label: start === end ? `${start}월` : `${start}월~${end}월` };
  }
  const single = raw.match(/^(\d{1,2})$/);
  if (single) {
    const m = Math.min(12, Math.max(1, Number(single[1])));
    return { start: m, end: m, label: `${m}월` };
  }
  return { start: 1, end: 12, label: "1월~12월" };
}
