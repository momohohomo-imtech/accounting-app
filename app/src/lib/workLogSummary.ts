import type { WorkLog } from "@/lib/types";
import { resolveSiteColor } from "@/lib/siteColor";

export type WorkLogSummaryRow = {
  siteId: string;
  siteName: string;
  siteColor: string;
  title: string;
  days: number;
  isSpecial: boolean;
};
export type SiteAggregateRow = {
  siteId: string;
  siteName: string;
  siteColor: string;
  jobTypeCount: number;
  dayCount: number;
};
export type SiteInfo = { id: string; name: string; color: string | null };

// 현장에 속하지 않는 고정 카테고리 — 실제로 쓰였는지와 상관없이 항상 한 줄씩 보여주고,
// 해당 기간에 없으면 0일로 표시한다.
const SPECIAL_TITLES = ["휴무", "사내", "기타"];
const SPECIAL_COLOR = "#e2e8f0";

type SiteTitleGroup = { siteId: string; siteName: string; title: string; dates: Set<string> };

/**
 * 날짜순으로 훑으면서 같은 현장에 내용이 빈 줄이 나오면 그 현장에서 마지막으로 입력됐던
 * 내용을 그대로 이어받는다 — 매일 내용을 재입력하지 않고 현장만 골라도(연속 작업)
 * 하나의 작업으로 합산되게 하기 위함. buildWorkLogSummary/buildSiteAggregate가 공유하는
 * 핵심 집계 로직.
 */
function groupBySiteAndTitle(rows: WorkLog[], siteById: Map<string, SiteInfo>) {
  const sorted = [...rows].sort((a, b) => a.log_date.localeCompare(b.log_date));
  const lastTitleBySite = new Map<string, string>();
  const groups = new Map<string, SiteTitleGroup>();
  const specialDates = new Map<string, Set<string>>(SPECIAL_TITLES.map((t) => [t, new Set<string>()]));

  for (const l of sorted) {
    const explicitTitle = (l.title ?? "").trim();

    if (SPECIAL_TITLES.includes(explicitTitle)) {
      specialDates.get(explicitTitle)?.add(l.log_date);
      continue;
    }

    if (!l.site_id) continue;
    const title = explicitTitle || lastTitleBySite.get(l.site_id) || "";
    if (explicitTitle) lastTitleBySite.set(l.site_id, explicitTitle);
    if (!title) continue;

    const siteName = siteById.get(l.site_id)?.name ?? "미지정";
    const key = `${l.site_id}::${title}`;
    const g = groups.get(key) ?? { siteId: l.site_id, siteName, title, dates: new Set<string>() };
    g.dates.add(l.log_date);
    groups.set(key, g);
  }

  return { groups, specialDates };
}

export function buildWorkLogSummary(rows: WorkLog[], sites: SiteInfo[]): WorkLogSummaryRow[] {
  const siteById = new Map(sites.map((s) => [s.id, s]));
  const { groups, specialDates } = groupBySiteAndTitle(rows, siteById);

  const siteRows: WorkLogSummaryRow[] = Array.from(groups.values())
    .map((g) => ({
      siteId: g.siteId,
      siteName: g.siteName,
      siteColor: resolveSiteColor(g.siteId, siteById.get(g.siteId)?.color),
      title: g.title,
      days: g.dates.size,
      isSpecial: false,
    }))
    .sort((a, b) => b.days - a.days);

  // 휴무/사내/기타는 정렬과 무관하게 항상 맨 아래 고정.
  const specialRows: WorkLogSummaryRow[] = SPECIAL_TITLES.map((t) => ({
    siteId: "",
    siteName: "-",
    siteColor: SPECIAL_COLOR,
    title: t,
    days: specialDates.get(t)?.size ?? 0,
    isSpecial: true,
  }));

  return [...siteRows, ...specialRows];
}

/** 현장별로 작업 종류가 몇 가지였는지, 총 며칠 일했는지 — 작업 집계를 현장 단위로 다시 묶은 것. */
export function buildSiteAggregate(rows: WorkLog[], sites: SiteInfo[]): SiteAggregateRow[] {
  const siteById = new Map(sites.map((s) => [s.id, s]));
  const { groups } = groupBySiteAndTitle(rows, siteById);

  const bySite = new Map<string, { siteName: string; titles: Set<string>; dates: Set<string> }>();
  for (const g of groups.values()) {
    const entry = bySite.get(g.siteId) ?? { siteName: g.siteName, titles: new Set<string>(), dates: new Set<string>() };
    entry.titles.add(g.title);
    for (const d of g.dates) entry.dates.add(d);
    bySite.set(g.siteId, entry);
  }

  return Array.from(bySite.entries())
    .map(([siteId, entry]) => ({
      siteId,
      siteName: entry.siteName,
      siteColor: resolveSiteColor(siteId, siteById.get(siteId)?.color),
      jobTypeCount: entry.titles.size,
      dayCount: entry.dates.size,
    }))
    .sort((a, b) => b.dayCount - a.dayCount);
}
