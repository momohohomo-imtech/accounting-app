// 공사 작업 순서 연도·현장 필터(사용자 요청 11/4 "년도별 현장별로 필터링 — 기본 현재 년도 현장 전체", DB 변경 없음).
// 검사: workSequenceFilter.test.ts
//  - 연도 = 순서표 일정이 걸친 해: 시작일 ~ 계획 끝과 예상(다 끝났으면 실제) 끝 중 늦은 날. 해를 넘기면 두 해 모두에 보이고, 안 끝난
//    늦은 작업은 오늘까지 이어진 것으로 봐서(lib/workSequence.ts forecastSchedule) 올해에도 보임 — 지금 하는 일이 "올해"에서 빠지지 않게.
//    시작일이 없는 순서표는 날짜를 모르므로 프로젝트 연도.
//  - 현장 = 순서표 프로젝트의 현장(현장 없는 프로젝트는 "현장 미지정").
//  - 주소: seqYear(없으면 올해, "전체"는 all로 남김 — 공사 메모 필터와 같은 방식), seqSite(없으면 전체, 현장 미지정은 none).
//    공사 관리의 다른 탭 필터(year·site_id·history…)와 이름이 겹치지 않게 따로 둠.
import { spanDates, totalSpan, type ScheduledStep, type SequenceStart } from "@/lib/workSequence";

export const SEQ_FILTER_ALL = "all";
export const SEQ_NO_SITE = "none";

export type SequenceFilter = {
  /** "all" 또는 연도("2026") */
  year: string;
  /** "all", 현장 아이디, 또는 현장 미지정("none") */
  site: string;
};

const isYear = (v: string | undefined): v is string => Boolean(v && /^\d{4}$/.test(v));

/** 주소 값 읽기 — 연도가 없거나 잘못됐으면 올해, 현장이 없으면 전체 */
export function parseSequenceFilter(params: { seqYear?: string; seqSite?: string }, currentYear: number): SequenceFilter {
  const y = params.seqYear;
  return {
    year: y === SEQ_FILTER_ALL || isYear(y) ? y : String(currentYear),
    site: params.seqSite?.trim() || SEQ_FILTER_ALL,
  };
}

/**
 * 순서표가 걸친 해(오름차순). forecastEnd = 예상(실제) 끝(순서표 시작부터, lib/workSequence.ts forecastSummary의 forecastEnd) —
 * 없으면 계획만. 시작일이 없으면 프로젝트 연도(그것도 없으면 빈 목록 = 연도 "전체"에서만 보임).
 */
export function sequenceYears(
  seq: SequenceStart,
  schedule: ScheduledStep[],
  forecastEnd: number | null | undefined,
  projectYear: number | null | undefined
): number[] {
  const end = Math.max(totalSpan(schedule), forecastEnd ?? 0);
  const range = spanDates(0, end, seq);
  if (!range) {
    const y = Number(projectYear);
    return Number.isInteger(y) && y > 0 ? [y] : [];
  }
  const out: number[] = [];
  for (let y = Number(range.from.slice(0, 4)); y <= Number(range.to.slice(0, 4)); y++) out.push(y);
  return out;
}

/** 필터에 맞는 순서표인지 — siteId가 없으면 현장 미지정 */
export function matchesSequenceFilter(item: { years: number[]; siteId: string | null | undefined }, filter: SequenceFilter): boolean {
  if (filter.year !== SEQ_FILTER_ALL && !item.years.includes(Number(filter.year))) return false;
  if (filter.site !== SEQ_FILTER_ALL && (item.siteId || SEQ_NO_SITE) !== filter.site) return false;
  return true;
}

/** 연도 선택 목록 — 순서표가 걸친 해 + 올해 + 고른 해, 최근 해가 위 */
export function sequenceYearOptions(years: number[][], currentYear: number, selected: string): number[] {
  const set = new Set<number>(years.flat());
  set.add(currentYear);
  if (isYear(selected)) set.add(Number(selected));
  return [...set].sort((a, b) => b - a);
}

/**
 * 팝업 열기·닫기·저장 주소에 붙일 필터("&seqYear=2025&seqSite=…") — 팝업을 닫아도 고른 연도·현장 그대로. 연도는 주소에 있었을 때만
 * (없으면 기본 = 올해라 안 붙임 — 닫은 주소가 지난 기록과 같아야 뒤로가기로 닫힘, lib/popupNavigation.ts).
 */
export function sequenceFilterQuery(filter: SequenceFilter, yearInAddress: boolean): string {
  const parts: string[] = [];
  if (yearInAddress) parts.push(`seqYear=${encodeURIComponent(filter.year)}`);
  if (filter.site !== SEQ_FILTER_ALL) parts.push(`seqSite=${encodeURIComponent(filter.site)}`);
  return parts.map((p) => `&${p}`).join("");
}

/** 주소의 연도가 쓸 수 있는 값인지(그대로 주소에 남길지) */
export function yearParamInAddress(seqYear: string | undefined): boolean {
  return seqYear === SEQ_FILTER_ALL || isYear(seqYear);
}
