// 공사 작업 순서 — 모든 순서표 모아 보기(사용자 요청 11/3 "1-3번" 중 2·3번, DB 변경 없음 — 검사: workSequenceOverview.test.ts).
//  - 오늘·이번 주 할 일(buildAgenda): 늦은 작업(계획 끝이 지났는데 미완료 — 목록 "지연 N단계"와 같은 기준) / 오늘 작업(예상 일정에
//    오늘이 들어감) / 이번 주 시작(내일부터 7일 안에 예상 시작)
//  - 팀별 일정(teamSchedule): 앞으로 2주, 팀 이름이 같으면 순서표가 달라도 한 팀(순서표마다 팀 목록이라 이름으로 묶음 — 그래서 팀
//    추가 때 전에 쓴 이름을 골라 쓰게 함). 같은 팀이 같은 날 다른 순서표 작업에도 잡히면 겹침으로 알림(한 순서표 안의 겹침은 순서표
//    화면이 알림)
// 날짜는 모두 예상 일정(lib/workSequence.ts forecastSchedule — 늦어진 만큼 밀림) 기준, 완료한 단계·시작일 없는 순서표는 뺌.
import {
  addDays,
  cleanTeamName,
  forecastSchedule,
  spanDates,
  statusLabel,
  stepStatus,
  weekdayOf,
  type ScheduledStep,
  type SequenceStart,
  type TeamColorKey,
  type Today,
  type WorkTeam,
} from "@/lib/workSequence";

export type OverviewSequence = {
  id: string;
  title: string;
  /** "현장 · 프로젝트" */
  projectLabel: string;
  seq: SequenceStart;
  teams: WorkTeam[];
  steps: { content: string; done: boolean; done_date: string | null; team_id: string | null }[];
  schedule: ScheduledStep[];
};

export type OverviewItem = {
  seqId: string;
  seqTitle: string;
  projectLabel: string;
  /** 순서표 안 순번(1부터) */
  stepNo: number;
  content: string;
  team: { name: string; color: TeamColorKey } | null;
  /** 예상 일정(날짜, 끝날 포함) */
  from: string;
  to: string;
  overdue: boolean;
  /** "2일 지남"(늦은 작업만) */
  lateLabel: string;
  /** 늦은 정도(정렬용, 시간으로 환산) */
  lateHours: number;
};

/** "11-05(목)" */
export const dayLabel = (ymd: string) => `${ymd.slice(5)}(${weekdayOf(ymd)})`;
/** "11-05(목)" 또는 "11-05(목)~11-07(토)" */
export const rangeLabel = (from: string, to: string) => (from === to ? dayLabel(from) : `${dayLabel(from)}~${dayLabel(to)}`);

/** 순서표마다 완료 안 한 단계를 예상 날짜로 펼침(시작일 없는 순서표는 뺌). 팀 색은 이름마다 하나 — 먼저 나온(최근에 고친) 순서표 색으로
 *  맞춤(모아 보기에서 같은 팀이 두 색으로 보이지 않게, 순서표 화면은 그 순서표 색 그대로). */
function openItems(list: OverviewSequence[], today: Today): OverviewItem[] {
  const out: OverviewItem[] = [];
  const colorByName = new Map<string, TeamColorKey>();
  for (const s of list) for (const t of s.teams) if (!colorByName.has(cleanTeamName(t.name))) colorByName.set(cleanTeamName(t.name), t.color);
  for (const s of list) {
    const forecast = forecastSchedule(s.steps, s.schedule, s.seq, today);
    if (!forecast) continue;
    const teamById = new Map(s.teams.map((t) => [t.id, t]));
    s.steps.forEach((step, i) => {
      if (step.done || !s.schedule[i]) return;
      const range = spanDates(forecast[i].start, forecast[i].end, s.seq);
      if (!range) return;
      const status = stepStatus(step, s.schedule[i], s.seq, today);
      const team = step.team_id ? teamById.get(step.team_id) : undefined;
      const overdue = status.state === "overdue";
      out.push({
        seqId: s.id,
        seqTitle: s.title,
        projectLabel: s.projectLabel,
        stepNo: i + 1,
        content: step.content,
        team: team ? { name: cleanTeamName(team.name), color: colorByName.get(cleanTeamName(team.name)) ?? team.color } : null,
        from: range.from,
        to: range.to,
        overdue,
        lateLabel: overdue ? statusLabel(status) : "",
        lateHours: overdue ? (status.lateUnit === "day" ? status.lateBy * 24 : status.lateBy) : 0,
      });
    });
  }
  return out;
}

const byDateThenPlace = (a: OverviewItem, b: OverviewItem) =>
  a.from.localeCompare(b.from) || a.projectLabel.localeCompare(b.projectLabel, "ko") || a.seqTitle.localeCompare(b.seqTitle, "ko") || a.stepNo - b.stepNo;

export type Agenda = {
  overdue: OverviewItem[];
  today: OverviewItem[];
  week: OverviewItem[];
  /** 이번 주 시작 칸의 마지막 날(오늘 + 6일) */
  weekEnd: string;
  /** 시작일이 없어 빠진 순서표 수 */
  skipped: number;
};

export function buildAgenda(list: OverviewSequence[], today: Today, weekDays = 7): Agenda {
  const weekEnd = addDays(today.date, weekDays - 1);
  const items = openItems(list, today);
  const overdue = items.filter((x) => x.overdue).sort((a, b) => b.lateHours - a.lateHours || byDateThenPlace(a, b));
  const rest = items.filter((x) => !x.overdue);
  return {
    overdue,
    today: rest.filter((x) => x.from <= today.date && today.date <= x.to).sort(byDateThenPlace),
    week: rest.filter((x) => x.from > today.date && x.from <= weekEnd).sort(byDateThenPlace),
    weekEnd,
    skipped: list.filter((s) => !s.seq.start_date).length,
  };
}

export type ScheduleDay = { date: string; weekend: boolean };
export type TeamConflictRange = { from: string; to: string; items: OverviewItem[] };
export type TeamScheduleRow = {
  name: string;
  color: TeamColorKey;
  items: OverviewItem[];
  /** 날짜 칸마다 그 팀 작업 수 */
  perDay: number[];
  /** 같은 날 다른 순서표 작업과 겹치는 날(이어진 날은 한 구간) */
  conflicts: TeamConflictRange[];
};

/** 팀별 일정 — list는 최근에 고친 순서표가 먼저(같은 이름 팀의 색은 먼저 나온 순서표 것). */
export function teamSchedule(list: OverviewSequence[], today: Today, days = 14): { days: ScheduleDay[]; rows: TeamScheduleRow[] } {
  const dayList: ScheduleDay[] = Array.from({ length: days }, (_, i) => {
    const date = addDays(today.date, i);
    const wd = weekdayOf(date);
    return { date, weekend: wd === "토" || wd === "일" };
  });
  const first = dayList[0].date;
  const last = dayList[dayList.length - 1].date;
  const rows = new Map<string, TeamScheduleRow>();
  for (const item of openItems(list, today)) {
    if (!item.team || item.to < first || item.from > last) continue;
    const row = rows.get(item.team.name) ?? { name: item.team.name, color: item.team.color, items: [], perDay: [], conflicts: [] };
    row.items.push(item);
    rows.set(item.team.name, row);
  }
  for (const row of rows.values()) {
    row.items.sort(byDateThenPlace);
    let open: TeamConflictRange | null = null;
    let openKey = "";
    row.perDay = dayList.map(({ date }) => {
      const on = row.items.filter((x) => x.from <= date && date <= x.to);
      const crossSequence = new Set(on.map((x) => x.seqId)).size >= 2;
      const key = crossSequence ? on.map((x) => `${x.seqId}:${x.stepNo}`).join("|") : "";
      if (crossSequence && open && key === openKey && addDays(open.to, 1) === date) open.to = date;
      else if (crossSequence) {
        open = { from: date, to: date, items: on };
        openKey = key;
        row.conflicts.push(open);
      } else {
        open = null;
        openKey = "";
      }
      return on.length;
    });
  }
  return { days: dayList, rows: [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, "ko")) };
}
