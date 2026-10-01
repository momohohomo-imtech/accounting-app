// 보고서 "출장 현황" 집계 — 출장일지 문서(프로젝트별 한 장, lib/tripLogDocs.ts)를 한 해·한 달 단위로 모아 봄.
// 출장 일수는 날짜를 한 번만 셈(같은 날 여러 프로젝트에 갔어도 하루), 투입 인원은 날짜별 사내 + 조공의 합(연인원).
import {
  latestTripContents,
  parseCount,
  sumHeadcount,
  tripProjectLabel,
  tripTotals,
  workDaySplit,
  type Headcount,
  type TripProjectDoc,
  type TripTotals,
} from "@/lib/tripLog";

const monthOf = (date: string) => Number(date.slice(5, 7));

/** 월을 고르면 그 달 날짜 줄·작업일지 날짜만 남긴 문서(그 달 출장이 없는 프로젝트는 뺌). month가 없으면 그대로. */
export function docsForMonth(docs: TripProjectDoc[], year: number, month: number | null): TripProjectDoc[] {
  if (!month) return docs;
  return docs
    .map((doc) => ({
      ...doc,
      days: doc.days.filter((d) => monthOf(d.work_date) === month),
      workDates: doc.workDates.filter((d) => monthOf(d) === month),
      periodLabel: `${year}년 ${month}월`,
    }))
    .filter((doc) => doc.days.length > 0);
}

export type TripOverviewTotals = Headcount & {
  /** 출장 간 날짜 수(같은 날 여러 프로젝트는 하루) */
  tripDays: number;
  /** 출장 간 프로젝트 수 */
  projects: number;
  /** 장비를 투입한 날짜 수 */
  equipmentDays: number;
};

export function tripOverviewTotals(docs: TripProjectDoc[]): TripOverviewTotals {
  const days = docs.flatMap((d) => d.days);
  return {
    tripDays: new Set(days.map((d) => d.work_date)).size,
    projects: docs.filter((d) => d.days.length > 0).length,
    ...sumHeadcount(days),
    equipmentDays: new Set(days.filter((d) => d.equipment_used).map((d) => d.work_date)).size,
  };
}

/** 1~12월 줄(출장이 없는 달도 0으로). */
export function tripMonthlyRows(docs: TripProjectDoc[]): (TripOverviewTotals & { month: number })[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const monthDocs = docs.map((doc) => ({ ...doc, days: doc.days.filter((d) => monthOf(d.work_date) === month) }));
    return { month, ...tripOverviewTotals(monthDocs) };
  });
}

export type TripCalendarDay = { people: number; projects: { label: string; people: number }[] };

/** 달력용 — 날짜별 투입 인원 합과 그날 간 프로젝트. */
export function tripCalendarDays(docs: TripProjectDoc[]): Map<string, TripCalendarDay> {
  const map = new Map<string, TripCalendarDay>();
  for (const doc of docs) {
    for (const d of doc.days) {
      const people = parseCount(d.staff_count) + parseCount(d.helper_count);
      const entry = map.get(d.work_date) ?? { people: 0, projects: [] };
      entry.people += people;
      entry.projects.push({ label: tripProjectLabel(doc), people });
      map.set(d.work_date, entry);
    }
  }
  return map;
}

/**
 * 달력 칸 진하기 0~4 — 0 = 출장 없음, 1 = 출장했지만 인원을 안 적음, 2~4 = 그 해 가장 많은 날 대비 투입 인원
 * (⅓ 이하 2, ⅔ 이하 3, 그 위 4).
 */
export function calendarLevel(people: number, maxPeople: number, hasTrip: boolean): 0 | 1 | 2 | 3 | 4 {
  if (!hasTrip) return 0;
  if (people <= 0 || maxPeople <= 0) return 1;
  return Math.min(4, 1 + Math.ceil((people / maxPeople) * 3)) as 2 | 3 | 4;
}

export type TripProjectRow = { doc: TripProjectDoc; totals: TripTotals; inhouse: number; latest: string };

/** 프로젝트별 줄 — 합계·내근 일수·최근 작업 내용(출장일지 탭 목록·내역서와 같은 계산). */
export function tripProjectRows(docs: TripProjectDoc[]): TripProjectRow[] {
  return docs.map((doc) => ({
    doc,
    totals: tripTotals(doc.days),
    inhouse: workDaySplit(doc.workDates, doc.days.map((d) => d.work_date)).inhouse,
    latest: latestTripContents(doc.days),
  }));
}

export type TripGroupRow = TripOverviewTotals & { name: string; from: string | null; to: string | null };

/** 원청사별·현장별 줄 — 이름이 없으면 "미지정". 출장 일수는 그 묶음 안에서 날짜를 한 번만 셈. */
export function tripGroupRows(docs: TripProjectDoc[], by: "client" | "site"): TripGroupRow[] {
  const groups = new Map<string, TripProjectDoc[]>();
  for (const doc of docs) {
    const name = (by === "client" ? doc.clientName : doc.siteName) || "미지정";
    groups.set(name, [...(groups.get(name) ?? []), doc]);
  }
  return Array.from(groups, ([name, list]) => {
    const dates = list.flatMap((doc) => doc.days.map((d) => d.work_date)).sort();
    return { name, ...tripOverviewTotals(list), from: dates[0] ?? null, to: dates[dates.length - 1] ?? null };
  });
}
