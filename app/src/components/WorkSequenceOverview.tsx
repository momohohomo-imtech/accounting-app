import Link from "next/link";
import { cx } from "@/lib/cx";
import { teamColor, weekdayOf } from "@/lib/workSequence";
import { dayLabel, rangeLabel, type Agenda, type OverviewItem, type ScheduleDay, type TeamScheduleRow } from "@/lib/workSequenceOverview";

// 공사 작업 순서 탭 맨 위 모아 보기(사용자 요청 11/3 "1-3번" 중 2·3번) — 모든 순서표의 오늘·이번 주 할 일, 팀별 2주 일정.
// 계산은 lib/workSequenceOverview.ts(예상 일정 기준 — 늦어진 만큼 밀림). 줄을 누르면 그 순서표 팝업(주소 ?seq=, 뒤로가기로 닫힘).

const TeamDot = ({ color }: { color: string }) => <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} aria-hidden />;

function AgendaLine({ item, openHref, kind }: { item: OverviewItem; openHref: string; kind: "overdue" | "today" | "week" }) {
  return (
    <li>
      <Link
        href={`${openHref}${item.seqId}`}
        scroll={false}
        className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md px-1.5 py-1.5 text-sm hover:bg-slate-50"
      >
        {kind === "overdue" && <span className="whitespace-nowrap font-semibold text-red-600">! {item.lateLabel}</span>}
        {kind === "week" && <span className="whitespace-nowrap font-medium tabular-nums text-slate-700">{dayLabel(item.from)}</span>}
        {item.team && (
          <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-slate-600">
            <TeamDot color={teamColor(item.team.color).hex} />
            {item.team.name}
          </span>
        )}
        <span className="font-medium text-slate-800">
          {item.stepNo}. {item.content}
        </span>
        <span className="text-xs text-slate-500">
          {item.projectLabel} · {item.seqTitle}
        </span>
        <span className="ml-auto whitespace-nowrap text-xs tabular-nums text-slate-500">{rangeLabel(item.from, item.to)}</span>
      </Link>
    </li>
  );
}

export function WorkSequenceAgenda({ agenda, todayDate, openHref }: { agenda: Agenda; todayDate: string; openHref: string }) {
  const groups = [
    { kind: "overdue" as const, title: "늦은 작업", note: "계획 끝이 지났는데 완료 안 됨", items: agenda.overdue, tone: "text-red-700" },
    { kind: "today" as const, title: "오늘 작업", note: "예상 일정에 오늘이 들어감", items: agenda.today, tone: "text-sky-800" },
    {
      kind: "week" as const,
      title: "이번 주 시작",
      note: `${dayLabel(agenda.weekEnd)}까지 시작 예정`,
      items: agenda.week,
      tone: "text-slate-700",
    },
  ];
  const empty = groups.every((g) => g.items.length === 0);
  return (
    <div className="space-y-3">
      <p className="flex flex-wrap gap-2 text-xs">
        {groups.map((g) => (
          <span
            key={g.kind}
            className={cx(
              "rounded-full px-2.5 py-1 font-semibold",
              g.kind === "overdue" && g.items.length > 0 ? "bg-red-50 text-red-700" : g.kind === "today" ? "bg-sky-50 text-sky-800" : "bg-slate-100 text-slate-700"
            )}
          >
            {g.title} {g.items.length}
          </span>
        ))}
        <span className="py-1 text-slate-500">{dayLabel(todayDate)} 기준 · 예상 일정(늦어진 만큼 밀림)</span>
      </p>
      {empty ? (
        <p className="py-2 text-sm text-slate-400">오늘·이번 주에 할 작업이 없습니다.</p>
      ) : (
        groups
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <div key={g.kind}>
              <p className={cx("text-xs font-semibold", g.tone)}>
                {g.title} {g.items.length} <span className="font-normal text-slate-400">— {g.note}</span>
              </p>
              <ul className="mt-0.5 divide-y divide-slate-100">
                {g.items.map((item) => (
                  <AgendaLine key={`${item.seqId}-${item.stepNo}`} item={item} openHref={openHref} kind={g.kind} />
                ))}
              </ul>
            </div>
          ))
      )}
      {agenda.skipped > 0 && <p className="text-[11px] text-slate-400">시작일이 없는 순서표 {agenda.skipped}개는 날짜를 몰라서 빠졌습니다.</p>}
    </div>
  );
}

/** 왼쪽 팀·작업 칸 — 휴대폰에선 좁게(날짜 칸이 더 보이게), 긴 이름은 말줄임 */
const LABEL_CLASS = "w-[150px] md:w-[220px]";
const DAY_WIDTH = 40;

export function WorkTeamSchedule({ days, rows, openHref }: { days: ScheduleDay[]; rows: TeamScheduleRow[]; openHref: string }) {
  if (rows.length === 0) {
    return (
      <p className="py-2 text-sm text-slate-400">
        앞으로 2주 안에 팀이 정해진 작업이 없습니다. 순서표에서 단계마다 팀을 고르면 여기에 모입니다(팀 이름이 같으면 한 팀).
      </p>
    );
  }
  const first = days[0].date;
  const index = (ymd: string) => days.findIndex((d) => d.date === ymd);
  const pct = (n: number) => `${(n / days.length) * 100}%`;
  const conflicts = rows.flatMap((r) => r.conflicts.map((c) => ({ team: r.name, color: r.color, ...c })));
  const track = { minWidth: days.length * DAY_WIDTH };
  return (
    <div className="space-y-3">
      {conflicts.length > 0 && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p className="font-semibold">
            같은 팀이 같은 날 다른 순서표 작업에도 잡혀 있습니다 {conflicts.length}건 — 일손이 되는지 확인해 주세요.
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {conflicts.map((c) => (
              <li key={`${c.team}-${c.from}`}>
                <span className="font-semibold">{c.team}</span> {rangeLabel(c.from, c.to)}:{" "}
                {c.items.map((x) => `${x.projectLabel} ${x.stepNo}번 ${x.content}`).join(" / ")}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <div className="w-max min-w-full text-xs">
          <div className="flex border-b border-slate-200 bg-slate-50">
            <div className={cx("shrink-0 border-r border-slate-200 px-2 py-1.5 font-medium text-slate-500", LABEL_CLASS)}>
              팀 · 작업
            </div>
            <div className="flex flex-1" style={track}>
              {days.map((d) => (
                <div
                  key={d.date}
                  className={cx(
                    "border-r border-slate-100 py-1 text-center leading-tight tabular-nums text-slate-500",
                    d.weekend && "bg-rose-50 text-rose-500",
                    d.date === first && "font-semibold text-red-600"
                  )}
                  style={{ width: pct(1) }}
                >
                  <div className="text-[10px]">{d.date === first ? "오늘" : weekdayOf(d.date)}</div>
                  <div>{d.date.slice(5)}</div>
                </div>
              ))}
            </div>
          </div>
          {rows.map((row) => {
            const hex = teamColor(row.color).hex;
            return (
              <div key={row.name} className="border-b border-slate-200 last:border-0">
                {/* 팀 줄 — 날마다 작업 수(2건 이상이면 노랑) */}
                <div className="flex bg-slate-50/60">
                  <div className={cx("flex shrink-0 items-center gap-1.5 border-r border-slate-200 px-2 py-1.5 font-semibold text-slate-800", LABEL_CLASS)}>
                    <TeamDot color={hex} />
                    <span className="truncate">{row.name}</span>
                    <span className="font-normal text-slate-400">{row.items.length}건</span>
                  </div>
                  <div className="flex flex-1" style={track}>
                    {row.perDay.map((n, i) => (
                      <div
                        key={days[i].date}
                        className={cx(
                          "border-r border-slate-100 py-1.5 text-center tabular-nums",
                          n >= 2 ? "bg-amber-100 font-semibold text-amber-800" : n === 1 ? "text-slate-600" : "text-slate-300",
                          n < 2 && days[i].weekend && "bg-rose-50/60"
                        )}
                        style={{ width: pct(1) }}
                        title={n >= 2 ? `${dayLabel(days[i].date)} ${row.name} 작업 ${n}건` : undefined}
                      >
                        {n || "·"}
                      </div>
                    ))}
                  </div>
                </div>
                {row.items.map((item) => {
                  const from = Math.max(0, index(item.from) === -1 ? 0 : index(item.from));
                  const toIdx = index(item.to);
                  const to = toIdx === -1 ? days.length - 1 : toIdx;
                  const cutLeft = item.from < first;
                  const cutRight = toIdx === -1;
                  return (
                    <Link
                      key={`${item.seqId}-${item.stepNo}`}
                      href={`${openHref}${item.seqId}`}
                      scroll={false}
                      className="flex border-t border-slate-100 hover:bg-slate-50"
                    >
                      <div className={cx("shrink-0 border-r border-slate-200 px-2 py-1", LABEL_CLASS)}>
                        <p className={cx("truncate font-medium", item.overdue ? "text-red-700" : "text-slate-800")} title={item.content}>
                          {item.stepNo}. {item.content}
                        </p>
                        <p className="truncate text-[11px] text-slate-500" title={`${item.projectLabel} · ${item.seqTitle}`}>
                          {item.projectLabel} · {item.seqTitle}
                        </p>
                      </div>
                      <div className="relative min-h-10 flex-1" style={track}>
                        {days.map((d, i) =>
                          d.weekend ? (
                            <div key={d.date} className="absolute inset-y-0 bg-rose-50/60" style={{ left: pct(i), width: pct(1) }} />
                          ) : null
                        )}
                        <div
                          className="absolute top-1/2 flex h-6 -translate-y-1/2 items-center overflow-hidden rounded text-[11px] font-semibold"
                          style={{
                            left: pct(from),
                            width: pct(to - from + 1),
                            background: hex,
                            color: teamColor(row.color).ink,
                            boxShadow: item.overdue ? "0 0 0 2px #fff, 0 0 0 4px #d03b3b" : undefined,
                          }}
                          title={`${item.projectLabel} · ${item.seqTitle} — ${item.stepNo}. ${item.content} (${rangeLabel(item.from, item.to)})`}
                        >
                          <span className="truncate px-1.5">
                            {cutLeft ? "◀ " : ""}
                            {item.overdue ? `! ${item.lateLabel}` : rangeLabel(item.from, item.to)}
                            {cutRight ? " ▶" : ""}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        팀 이름이 같으면 순서표가 달라도 한 팀으로 묶습니다 · 숫자 = 그날 작업 수(노랑 = 2건 이상) · 빨간 테두리 = 계획보다 늦음 · 예상 일정(늦어진
        만큼 밀림) 기준, 완료한 작업은 뺌
      </p>
    </div>
  );
}
