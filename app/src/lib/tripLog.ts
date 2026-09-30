// 출장일지(새 방식, SQL 090) — 작업일지 팝업에서 "출장"을 체크한 날짜가 프로젝트별 출장일지 한 장에 모임.
// 날짜 줄(trip_log_days) ↔ 입력칸 값 변환과 맨 위 합계(총 일수·총 투입 인원).

export type TripDayRow = {
  id: string;
  project_id: string;
  work_date: string;
  staff_count: number;
  helper_count: number;
  equipment_used: boolean;
  equipment_place: string | null;
  equipment_hours: string | null;
  note: string | null;
};

/** 작업일지 팝업·출장일지 수정 화면의 날짜 줄 입력값 — 인원 칸은 입력 중 빈 글자도 허용. */
export type TripDayInput = {
  staff: string;
  helper: string;
  equipmentUsed: boolean;
  place: string;
  hours: string;
  note: string;
};

export const EMPTY_TRIP_DAY_INPUT: TripDayInput = {
  staff: "",
  helper: "",
  equipmentUsed: false,
  place: "",
  hours: "",
  note: "",
};

export function tripDayToInput(d: Pick<TripDayRow, "staff_count" | "helper_count" | "equipment_used" | "equipment_place" | "equipment_hours" | "note">): TripDayInput {
  return {
    staff: d.staff_count ? String(d.staff_count) : "",
    helper: d.helper_count ? String(d.helper_count) : "",
    equipmentUsed: d.equipment_used,
    place: d.equipment_place ?? "",
    hours: d.equipment_hours ?? "",
    note: d.note ?? "",
  };
}

/** 인원 칸 글자 → 0 이상의 정수(빈칸·글자·음수는 0, 소수는 버림). */
export function parseCount(value: string | number | null | undefined): number {
  const n = Math.floor(Number(String(value ?? "").trim()));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** 입력값 → 저장할 칸. 장비를 안 썼으면 사용처·시간은 비움(비고는 날짜 비고라 그대로). */
export function inputToTripDayFields(input: TripDayInput) {
  const text = (v: string) => v.trim() || null;
  return {
    staff_count: parseCount(input.staff),
    helper_count: parseCount(input.helper),
    equipment_used: input.equipmentUsed,
    equipment_place: input.equipmentUsed ? text(input.place) : null,
    equipment_hours: input.equipmentUsed ? text(input.hours) : null,
    note: text(input.note),
  };
}

export type TripTotals = {
  /** 출장 날짜 수 */
  days: number;
  staff: number;
  helper: number;
  /** 총 투입 인원(연인원) = 날짜별 사내 + 조공의 합 */
  people: number;
  /** 장비를 투입한 날짜 수 */
  equipmentDays: number;
  from: string | null;
  to: string | null;
};

export function tripTotals(
  days: Pick<TripDayRow, "work_date" | "staff_count" | "helper_count" | "equipment_used">[]
): TripTotals {
  const dates = new Set(days.map((d) => d.work_date));
  const equipmentDates = new Set(days.filter((d) => d.equipment_used).map((d) => d.work_date));
  const staff = days.reduce((s, d) => s + parseCount(d.staff_count), 0);
  const helper = days.reduce((s, d) => s + parseCount(d.helper_count), 0);
  const sorted = Array.from(dates).sort();
  return {
    days: dates.size,
    staff,
    helper,
    people: staff + helper,
    equipmentDays: equipmentDates.size,
    from: sorted[0] ?? null,
    to: sorted[sorted.length - 1] ?? null,
  };
}

/** 출장일지 한 장(프로젝트 하나) — 원청사·현장은 프로젝트에서, 작업구분·비고는 trip_logs에서. */
export type TripProjectDoc = {
  projectId: string;
  projectName: string;
  projectCode: string | null;
  siteName: string | null;
  clientName: string | null;
  workTypes: string[];
  note: string;
  /** 날짜순. contents = 그날 그 프로젝트 작업일지 내용(작업 집계와 같은 이어받기 규칙). */
  days: (TripDayRow & { contents: string })[];
};

export function tripProjectLabel(doc: Pick<TripProjectDoc, "projectCode" | "projectName">) {
  return doc.projectCode ? `${doc.projectCode} ${doc.projectName}` : doc.projectName;
}
