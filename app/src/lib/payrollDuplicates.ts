// 급여대장 일괄 등록 때 같은 직원·같은 달 급여가 이미 있는지 — 같은 대장을 두 번 올리면 그 달 급여가 두 번 잡혀서, 등록 전에
// 알려 줌(상여금처럼 같은 달에 따로 주는 경우가 있어 막지는 않고 확인만).

// "2026-09-25" → 그 달 1일 ~ 다음 달 1일(다음 달 1일은 빼고)
export function monthRangeOf(date: string): { start: string; end: string } {
  const [y, m] = date.slice(0, 7).split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { start: `${date.slice(0, 7)}-01`, end: `${next}-01` };
}

// 새로 올릴 줄 중 같은 직원·같은 달 급여가 이미 있는 직원 이름(중복 없이, 올린 순서대로).
export function duplicatePayrollNames(
  incoming: { employee_id: string; pay_month: string }[],
  existing: { employee_id: string; pay_month: string; name: string | null }[]
): string[] {
  const has = new Set(existing.map((e) => `${e.employee_id}|${e.pay_month.slice(0, 7)}`));
  const nameOf = new Map(existing.map((e) => [e.employee_id, e.name ?? "이름 없음"]));
  const names: string[] = [];
  for (const r of incoming) {
    const name = nameOf.get(r.employee_id);
    if (has.has(`${r.employee_id}|${r.pay_month.slice(0, 7)}`) && name && !names.includes(name)) names.push(name);
  }
  return names;
}
