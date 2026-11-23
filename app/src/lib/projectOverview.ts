// 보고서 "프로젝트 한눈에 보기"(사용자 요청 11/23 — 전체 프로젝트 요약 + 프로젝트별 표, 인쇄): 첫 줄 발주액·수주액·매입·이익금·
// 이익율, 둘째 줄 근무일당 이익금·근무일·출장 횟수(이어진 출장일은 1회). 검사: projectOverview.test.ts
//
// 기준(사용자 결정 "추천대로"):
//  - 줄 = 프로젝트 묶음(어미 + 귀속 하위 — lib/projectProfit.ts의 projectGroups, 줄을 누르면 여는 프로젝트 보고서와 같은 묶음)
//  - 수주액 = 발주액 − 대행구매(수기 입력 수주액이 아니라 — 그래야 이익금 = 수주액 − 매입으로 맞음)
//  - 검토중 프로젝트의 발주액은 넣지 않고 이미 쓴 매입·대행구매만(보고서 "프로젝트별 손익" 머리 요약과 같은 계산 — 합계가 그 숫자와 같음)
//  - 이익율 = 이익금 ÷ 발주액(프로젝트별 손익 표와 같게), 발주액이 없으면 "-"
//  - 근무일 = 묶음 안 작업일지·출장 날짜(같은 날은 하루, 출장 체크한 날은 출장 — workDaySplitForProjects), 합계 = 줄 합(같은 날
//    두 프로젝트를 했으면 2일 — 표의 합계가 줄을 더한 값과 같게)
//  - 출장 횟수 = 묶음의 출장 날짜 중 이어진 날은 1회(tripCountForProjects), 합계 = 줄 합
import { projectGroups } from "@/lib/projectProfit";
import {
  profitPerWorkDay,
  tripCountForProjects,
  workDaySplitForProjects,
  type TripDayRow,
  type WorkDaySplit,
} from "@/lib/tripLog";

export type OverviewProject = {
  id: string;
  project_code: string | null;
  name: string;
  status: string | null;
  parent_project_id: string | null;
  quote_amount: number | null;
};

export type ProjectOverviewRow = {
  /** 묶음 맨 위 어미 id — 줄을 누르면 이 프로젝트 보고서(하위까지 합침) */
  id: string;
  code: string | null;
  name: string;
  /** 묶음에 든 프로젝트 수(어미 포함) */
  memberCount: number;
  /** 발주액 — 검토중이 아닌 프로젝트만 */
  quote: number;
  /** 검토중이라 빠진 발주액(화면에 줄 그어 보여 줌) */
  reviewQuote: number;
  /** 묶음 전체가 검토중(어미가 검토중) */
  review: boolean;
  agency: number;
  /** 수주액 = 발주액 − 대행구매 */
  contract: number;
  /** 매입(공급가액 기준 — 보고서 프로젝트별 손익과 같은 값) */
  purchase: number;
  /** 이익금 = 수주액 − 매입 */
  profit: number;
  /** 이익금 ÷ 발주액 × 100 — 발주액이 없으면 null */
  profitRate: number | null;
  workDays: WorkDaySplit;
  tripCount: number;
  /** 이익금 ÷ 근무일 — 발주액이나 근무일이 없으면 null */
  profitPerDay: number | null;
};

export function projectOverviewRows<P extends OverviewProject>(input: {
  projects: P[];
  /** 프로젝트마다 매입(공급가액) */
  purchaseByProject: Map<string, number>;
  agencyByProject: Map<string, number>;
  /** 검토중으로 볼지(묶음 안 "타 프로젝트 귀속" 하위는 어미 상태 — 보고서 page의 isReview) */
  isReview: (p: P) => boolean;
  workLogs: { log_date: string; project_id: string | null }[];
  tripDays: Pick<TripDayRow, "project_id" | "work_date">[] | null;
}): ProjectOverviewRow[] {
  return projectGroups(input.projects).map(({ root, members }) => {
    const ids = members.map((m) => m.id);
    const quoteOf = (m: P) => m.quote_amount ?? 0;
    const quote = members.filter((m) => !input.isReview(m)).reduce((s, m) => s + quoteOf(m), 0);
    const reviewQuote = members.filter((m) => input.isReview(m)).reduce((s, m) => s + quoteOf(m), 0);
    const agency = members.reduce((s, m) => s + (input.agencyByProject.get(m.id) ?? 0), 0);
    const purchase = members.reduce((s, m) => s + (input.purchaseByProject.get(m.id) ?? 0), 0);
    const contract = quote - agency;
    const profit = contract - purchase;
    const workDays = workDaySplitForProjects(input.workLogs, input.tripDays, ids);
    return {
      id: root.id,
      code: root.project_code,
      name: root.name,
      memberCount: members.length,
      quote,
      reviewQuote,
      review: input.isReview(root),
      agency,
      contract,
      purchase,
      profit,
      profitRate: quote > 0 ? (profit / quote) * 100 : null,
      workDays,
      tripCount: tripCountForProjects(input.tripDays, ids),
      profitPerDay: profitPerWorkDay(quote > 0 ? profit : null, workDays.total),
    };
  });
}

export type ProjectOverviewTotals = {
  count: number;
  reviewCount: number;
  quote: number;
  agency: number;
  contract: number;
  purchase: number;
  profit: number;
  profitRate: number | null;
  workDays: WorkDaySplit;
  tripCount: number;
  /** 출장 한 번에 평균 며칠(출장일 ÷ 출장 횟수) — 출장이 없으면 null */
  avgTripDays: number | null;
  profitPerDay: number | null;
};

/** 위 요약 칸 = 표 합계 줄 — 모두 줄을 더한 값(이익율·근무일당 이익금만 합계로 다시 나눔). */
export function projectOverviewTotals(rows: ProjectOverviewRow[]): ProjectOverviewTotals {
  const sum = (f: (r: ProjectOverviewRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  const quote = sum((r) => r.quote);
  const profit = sum((r) => r.profit);
  const workDays = {
    inhouse: sum((r) => r.workDays.inhouse),
    trip: sum((r) => r.workDays.trip),
    total: sum((r) => r.workDays.total),
  };
  const tripCount = sum((r) => r.tripCount);
  return {
    count: rows.length,
    reviewCount: rows.filter((r) => r.review).length,
    quote,
    agency: sum((r) => r.agency),
    contract: sum((r) => r.contract),
    purchase: sum((r) => r.purchase),
    profit,
    profitRate: quote > 0 ? (profit / quote) * 100 : null,
    workDays,
    tripCount,
    avgTripDays: tripCount > 0 ? workDays.trip / tripCount : null,
    profitPerDay: profitPerWorkDay(quote > 0 ? profit : null, workDays.total),
  };
}

/** 이익율 글자 — 소수 둘째 자리(보고서 머리 요약과 같게), 없으면 "-" */
export function formatProfitRate(rate: number | null): string {
  return rate === null ? "-" : `${rate.toFixed(2)}%`;
}
