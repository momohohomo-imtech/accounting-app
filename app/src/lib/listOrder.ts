// 목록 기본 순서(사용자 요청 11/7 "목록 순서") — 처음 보이는 순서만 정함. 머리글을 누르면 그 칸으로 정렬되는 건 그대로.
// 원칙: 기록·내역은 최신이 위(같은 날은 나중에 등록한 것이 위 — lib/entryOrder.ts), 거래처·사람 목록은 이름(사원번호)순.
// 검사: listOrder.test.ts
import { compareEntry } from "@/lib/entryOrder";

const ko = (a: string | null | undefined, b: string | null | undefined) => (a ?? "").localeCompare(b ?? "", "ko");
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** 거래처·현장 — 이름 가나다순(같은 이름은 id로 늘 같은 순서). */
export function byName<T extends { id: string; name: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => ko(a.name, b.name) || byId(a, b));
}

/** 일용직 — 근무중 먼저, 그다음 이름 가나다순(출입명단에서 고를 때와 같은 이름순). */
export function dailyWorkersOrder<T extends { id: string; name: string | null; status: string | null }>(rows: T[]): T[] {
  const ended = (r: T) => (r.status === "active" ? 0 : 1);
  return [...rows].sort((a, b) => ended(a) - ended(b) || ko(a.name, b.name) || byId(a, b));
}

/** 직원 — 재직자 먼저(퇴사일이 없거나 아직 안 지남), 그 안은 받은 순서(사원번호순) 그대로. today = 한국 날짜 YYYY-MM-DD. */
export function activeEmployeesFirst<T extends { resigned_date: string | null }>(rows: T[], today: string): T[] {
  const resigned = (r: T) => (r.resigned_date && r.resigned_date < today ? 1 : 0);
  return [...rows].sort((a, b) => resigned(a) - resigned(b));
}

/** 급여 이력 — 지급월 최신순, 같은 달은 사원번호순(employeeRank = 사원번호순 자리), 같은 사람은 먼저 등록한 것부터. */
export function payrollOrder<T extends { id: string; pay_month: string; employee_id: string; created_at?: string | null }>(
  rows: T[],
  employeeRank: Map<string, number>
): T[] {
  const rank = (r: T) => employeeRank.get(r.employee_id) ?? Number.MAX_SAFE_INTEGER;
  return [...rows].sort(
    (a, b) => (a.pay_month < b.pay_month ? 1 : a.pay_month > b.pay_month ? -1 : 0) || rank(a) - rank(b) || compareEntry(a, b)
  );
}

/** 저장 시각(ISO) → 한국 날짜 YYYY-MM-DD. 날짜가 아니면 빈 글자. */
function kstDateOf(iso: string | null | undefined): string {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? new Date(t + 9 * 3600_000).toISOString().slice(0, 10) : "";
}

/** 공구명세서 이력의 출장일 정렬 기준 — 출장일, 없으면 저장한 날(한국 날짜) 자리에 끼움. */
export function toolChecklistDay(r: { trip_date: string | null; created_at: string }): string {
  return r.trip_date || kstDateOf(r.created_at);
}

/** 공구명세서 이력 출장일 비교(오름차순) — 같은 날이면 저장 순서. 최신순은 부호를 뒤집어 씀. */
export function compareToolChecklistDay<T extends { id: string; trip_date: string | null; created_at: string }>(a: T, b: T): number {
  const da = toolChecklistDay(a);
  const db = toolChecklistDay(b);
  if (da !== db) return da < db ? -1 : 1;
  return compareEntry(a, b);
}
