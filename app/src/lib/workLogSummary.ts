import type { WorkLog } from "@/lib/types";
import { resolveSiteColor } from "@/lib/siteColor";
import { one } from "@/lib/relations";

export type WorkLogSummaryRow = {
  siteId: string;
  siteName: string;
  siteColor: string;
  title: string;
  days: number;
  dates: string[];
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
export const SPECIAL_TITLES = ["휴무", "사내", "기타"];
const SPECIAL_COLOR = "#e2e8f0";

export type WorkLogTitleRow = {
  log_date: string;
  site_id: string | null;
  project_id: string | null;
  title: string | null;
  sort_order?: number | null;
  /** 이 줄에 고른 프로젝트(work_logs → projects(name)로 같이 조회). */
  projects?: { name: string | null } | { name: string | null }[] | null;
};

export type ResolvedWorkLog<T> = {
  row: T;
  /** 집계에 쓰는 내용 — 빈 줄이면 이어받은 내용이나 프로젝트 이름, 정할 수 없으면 "". */
  title: string;
  source: "explicit" | "inherited" | "project" | "none";
};

/**
 * 작업일지 줄의 "내용" 정하기 — 작업 집계·집계 팝업·현장집계·출장일지(날짜별 작업 내용)가 모두 이 규칙을 씀.
 * 날짜순(같은 날은 입력 순서)으로 훑으면서
 *  - 내용을 적은 줄: 그 내용.
 *  - 내용이 빈 줄 + 프로젝트를 고른 줄: 같은 현장·같은 프로젝트에서 마지막으로 적은 내용, 없으면 그 프로젝트 이름.
 *    (예전엔 현장만 같으면 다른 프로젝트 줄까지 이어받아서, 하루 한 일이 그 뒤 다른 프로젝트 날짜까지 같은
 *    일로 합산됐음.)
 *  - 내용도 프로젝트도 없는 줄: 예전처럼 그 현장에서 마지막으로 적은 내용 — 현장만 골라도 이어지는 작업으로 합산.
 * 휴무·사내·기타는 이어받을 내용으로 기억하지 않음. 앞 줄에서 이어받으므로 기간 집계도 그 해 1월 1일부터
 * 넘겨서 정한 뒤 기간 안의 줄만 세야 연간으로 찾는 팝업과 결과가 같음.
 */
export function resolveWorkLogTitles<T extends WorkLogTitleRow>(rows: T[]): ResolvedWorkLog<T>[] {
  const sorted = [...rows].sort(
    (a, b) => a.log_date.localeCompare(b.log_date) || (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
  const lastBySite = new Map<string, string>();
  const lastBySiteProject = new Map<string, string>();

  return sorted.map((row): ResolvedWorkLog<T> => {
    const explicit = (row.title ?? "").trim();
    if (explicit) {
      if (row.site_id && !SPECIAL_TITLES.includes(explicit)) {
        lastBySite.set(row.site_id, explicit);
        if (row.project_id) lastBySiteProject.set(`${row.site_id}|${row.project_id}`, explicit);
      }
      return { row, title: explicit, source: "explicit" };
    }
    if (!row.site_id) return { row, title: "", source: "none" };
    if (row.project_id) {
      const sameProject = lastBySiteProject.get(`${row.site_id}|${row.project_id}`);
      if (sameProject) return { row, title: sameProject, source: "inherited" };
      const projectName = (one(row.projects)?.name ?? "").trim();
      if (projectName) return { row, title: projectName, source: "project" };
    }
    const sameSite = lastBySite.get(row.site_id);
    return sameSite ? { row, title: sameSite, source: "inherited" } : { row, title: "", source: "none" };
  });
}

/** 집계 기간(이 날짜들 안의 줄만 셈) — 없으면 넘긴 줄 전부. */
export type DateRange = { from: string; to: string };

type SiteTitleGroup = { siteId: string; siteName: string; title: string; dates: Set<string> };

// buildWorkLogSummary/buildSiteAggregate가 공유하는 핵심 집계 — (현장, 내용)별 날짜.
function groupBySiteAndTitle(rows: WorkLog[], siteById: Map<string, SiteInfo>, range?: DateRange) {
  const groups = new Map<string, SiteTitleGroup>();
  const specialDates = new Map<string, Set<string>>(SPECIAL_TITLES.map((t) => [t, new Set<string>()]));

  for (const { row: l, title, source } of resolveWorkLogTitles(rows)) {
    if (range && (l.log_date < range.from || l.log_date > range.to)) continue;

    if (source === "explicit" && SPECIAL_TITLES.includes(title)) {
      specialDates.get(title)?.add(l.log_date);
      continue;
    }

    if (!l.site_id || !title) continue;

    const siteName = siteById.get(l.site_id)?.name ?? "미지정";
    const key = `${l.site_id}::${title}`;
    const g = groups.get(key) ?? { siteId: l.site_id, siteName, title, dates: new Set<string>() };
    g.dates.add(l.log_date);
    groups.set(key, g);
  }

  return { groups, specialDates };
}

// rows에는 기간 앞(그 해 1월 1일부터)의 줄도 넘길 것 — 이어받을 내용을 찾는 데만 쓰고, 세는 건 range 안의 줄만.
export function buildWorkLogSummary(rows: WorkLog[], sites: SiteInfo[], range?: DateRange): WorkLogSummaryRow[] {
  const siteById = new Map(sites.map((s) => [s.id, s]));
  const { groups, specialDates } = groupBySiteAndTitle(rows, siteById, range);

  const siteRows: WorkLogSummaryRow[] = Array.from(groups.values())
    .map((g) => ({
      siteId: g.siteId,
      siteName: g.siteName,
      siteColor: resolveSiteColor(g.siteId, siteById.get(g.siteId)?.color),
      title: g.title,
      days: g.dates.size,
      dates: Array.from(g.dates).sort(),
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
    dates: Array.from(specialDates.get(t) ?? []).sort(),
    isSpecial: true,
  }));

  return [...siteRows, ...specialRows];
}

/** 현장별로 작업 종류가 몇 가지였는지, 총 며칠 일했는지 — 작업 집계를 현장 단위로 다시 묶은 것. */
export function buildSiteAggregate(rows: WorkLog[], sites: SiteInfo[], range?: DateRange): SiteAggregateRow[] {
  const siteById = new Map(sites.map((s) => [s.id, s]));
  const { groups } = groupBySiteAndTitle(rows, siteById, range);

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
