"use client";

import { Fragment, useMemo, useState } from "react";
import { countLabel, formatTripPeriod, tripProjectLabel, type TripProjectDoc } from "@/lib/tripLog";
import {
  calendarLevel,
  docsForMonth,
  tripCalendarDays,
  tripGroupRows,
  tripMonthlyRows,
  tripOverviewTotals,
  tripProjectRows,
  type TripGroupRow,
  type TripProjectRow,
} from "@/lib/tripOverview";
import { TripLogPopup } from "@/components/TripLogPopup";
import { Button } from "@/components/ui/Button";
import { inlineFieldClass } from "@/components/ui/field";
import { cx } from "@/lib/cx";

type View = "project" | "client" | "site";
const VIEWS: { key: View; label: string }[] = [
  { key: "project", label: "프로젝트별" },
  { key: "client", label: "원청사별" },
  { key: "site", label: "현장별" },
];
// 달력 진하기 — 한 색(남색)을 밝은 → 진한 순으로. 0 = 출장 없음, 1 = 출장했지만 인원 안 적음, 2~4 = 인원 많을수록 진하게.
const LEVEL_CLASS = ["bg-slate-100", "bg-indigo-100", "bg-indigo-300", "bg-indigo-500", "bg-indigo-700"] as const;
const DAY_LABELS = new Set([1, 10, 20, 30]);
const pad = (n: number) => String(n).padStart(2, "0");

type SortDir = "asc" | "desc";

// 목록형 표 정렬(CLAUDE.md 규칙) — 같은 칸을 다시 누르면 asc/desc, 다른 칸은 asc부터.
function useSort<K extends string>(initialKey: K, initialDir: SortDir) {
  const [sortKey, setSortKey] = useState<K>(initialKey);
  const [sortDir, setSortDir] = useState<SortDir>(initialDir);
  function handleSort(key: K) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }
  function header(key: K, label: string) {
    return (
      <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 whitespace-nowrap hover:text-slate-800">
        {label}
        {sortKey === key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  }
  return { sortKey, sortDir, header };
}

function sortRows<T>(rows: T[], value: (r: T) => string | number, dir: SortDir): T[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
    return dir === "asc" ? cmp : -cmp;
  });
  return copy;
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 px-3 py-2.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 whitespace-nowrap text-xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

type ProjectKey = "project" | "site" | "client" | "period" | "days" | "inhouse" | "staff" | "helper" | "people" | "equipment";

function projectSortValue(r: TripProjectRow, key: ProjectKey): string | number {
  switch (key) {
    case "project":
      return tripProjectLabel(r.doc);
    case "site":
      return r.doc.siteName ?? "";
    case "client":
      return r.doc.clientName ?? "";
    case "period":
      return `${r.totals.to ?? ""}|${r.totals.from ?? ""}`;
    case "days":
      return r.totals.days;
    case "inhouse":
      return r.inhouse;
    case "staff":
      return r.totals.staff;
    case "helper":
      return r.totals.helper;
    case "people":
      return r.totals.people;
    case "equipment":
      return r.totals.equipmentDays;
  }
}

function ProjectTable({ rows, onOpen }: { rows: TripProjectRow[]; onOpen: (projectId: string) => void }) {
  const { sortKey, sortDir, header } = useSort<ProjectKey>("period", "desc");
  const sorted = useMemo(() => sortRows(rows, (r) => projectSortValue(r, sortKey), sortDir), [rows, sortKey, sortDir]);
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full min-w-[860px] text-sm print:min-w-0 print:text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="pb-2 pr-3">{header("project", "프로젝트")}</th>
            <th className="pb-2 pr-3">{header("site", "현장")}</th>
            <th className="pb-2 pr-3">{header("client", "원청사")}</th>
            <th className="pb-2 pr-3">{header("period", "기간")}</th>
            <th className="pb-2 pr-3 text-right">{header("days", "출장")}</th>
            <th className="pb-2 pr-3 text-right">{header("inhouse", "내근")}</th>
            <th className="pb-2 pr-3 text-right">{header("staff", "사내")}</th>
            <th className="pb-2 pr-3 text-right">{header("helper", "조공")}</th>
            <th className="pb-2 pr-3 text-right">{header("people", "총 투입")}</th>
            <th className="pb-2 pr-3 text-right">{header("equipment", "장비")}</th>
            <th className="pb-2 text-right print:hidden">내역서</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.doc.projectId} className="border-b border-slate-100 last:border-0">
              <td
                className="py-2 pr-3 font-medium text-slate-900 max-md:max-w-[10rem] max-md:truncate print:max-w-none print:overflow-visible print:whitespace-normal"
                title={tripProjectLabel(r.doc)}
              >
                {tripProjectLabel(r.doc)}
              </td>
              <td className="py-2 pr-3 text-slate-700">{r.doc.siteName ?? ""}</td>
              <td className="py-2 pr-3 text-slate-700">{r.doc.clientName ?? ""}</td>
              <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-slate-600">{formatTripPeriod(r.totals)}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-slate-900">{countLabel(r.totals.days, "일")}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{countLabel(r.inhouse, "일")}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{countLabel(r.totals.staff, "명")}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{countLabel(r.totals.helper, "명")}</td>
              <td className="py-2 pr-3 text-right font-semibold tabular-nums text-slate-900">{countLabel(r.totals.people, "명")}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{countLabel(r.totals.equipmentDays, "일")}</td>
              <td className="py-2 text-right print:hidden">
                <Button type="button" variant="secondary" size="xs" onClick={() => onOpen(r.doc.projectId)}>
                  보기
                </Button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={11} className="py-8 text-center text-slate-400">
                이 기간에 출장이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

type GroupKey = "name" | "projects" | "days" | "staff" | "helper" | "people" | "equipment" | "period";

function groupSortValue(r: TripGroupRow, key: GroupKey): string | number {
  switch (key) {
    case "name":
      return r.name;
    case "projects":
      return r.projects;
    case "days":
      return r.tripDays;
    case "staff":
      return r.staff;
    case "helper":
      return r.helper;
    case "people":
      return r.people;
    case "equipment":
      return r.equipmentDays;
    case "period":
      return `${r.to ?? ""}|${r.from ?? ""}`;
  }
}

function GroupTable({ rows, label, onPick }: { rows: TripGroupRow[]; label: string; onPick: (name: string) => void }) {
  // 출장을 많이 간 곳이 위로
  const { sortKey, sortDir, header } = useSort<GroupKey>("days", "desc");
  const sorted = useMemo(() => sortRows(rows, (r) => groupSortValue(r, sortKey), sortDir), [rows, sortKey, sortDir]);
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full min-w-[720px] text-sm print:min-w-0 print:text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="pb-2 pr-3">{header("name", label)}</th>
            <th className="pb-2 pr-3 text-right">{header("projects", "프로젝트")}</th>
            <th className="pb-2 pr-3 text-right">{header("days", "출장 일수")}</th>
            <th className="pb-2 pr-3 text-right">{header("staff", "사내")}</th>
            <th className="pb-2 pr-3 text-right">{header("helper", "조공")}</th>
            <th className="pb-2 pr-3 text-right">{header("people", "총 투입")}</th>
            <th className="pb-2 pr-3 text-right">{header("equipment", "장비")}</th>
            <th className="pb-2 pr-3">{header("period", "기간")}</th>
            <th className="pb-2 text-right print:hidden">프로젝트</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.name} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-3 font-medium text-slate-900">{r.name}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{countLabel(r.projects, "건")}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-slate-900">{countLabel(r.tripDays, "일")}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{countLabel(r.staff, "명")}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{countLabel(r.helper, "명")}</td>
              <td className="py-2 pr-3 text-right font-semibold tabular-nums text-slate-900">{countLabel(r.people, "명")}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{countLabel(r.equipmentDays, "일")}</td>
              <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-slate-600">{formatTripPeriod(r)}</td>
              <td className="py-2 text-right print:hidden">
                <Button type="button" variant="secondary" size="xs" onClick={() => onPick(r.name)}>
                  보기
                </Button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="py-8 text-center text-slate-400">
                이 기간에 출장이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// 보고서 "출장 현황" — 출장일지(작업일지 팝업에서 "출장"을 체크한 날)를 한 해 단위로 한눈에. 맨 위 기간(월)을 고르면
// 숫자칸·표가 그 달로 바뀌고(막대를 눌러도 같음), 월별 막대·달력은 늘 한 해 전체를 보여주고 고른 달만 진하게.
export function TripOverviewReport({ docs, year }: { docs: TripProjectDoc[]; year: number }) {
  const [month, setMonth] = useState<number | null>(null);
  const [view, setView] = useState<View>("project");
  const [groupFilter, setGroupFilter] = useState<{ by: "client" | "site"; name: string } | null>(null);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const monthly = useMemo(() => tripMonthlyRows(docs), [docs]);
  const calendar = useMemo(() => tripCalendarDays(docs), [docs]);
  const maxPeople = useMemo(() => Math.max(0, ...Array.from(calendar.values(), (d) => d.people)), [calendar]);
  const maxDays = Math.max(0, ...monthly.map((m) => m.tripDays));
  const periodDocs = useMemo(() => docsForMonth(docs, year, month), [docs, year, month]);
  const totals = useMemo(() => tripOverviewTotals(periodDocs), [periodDocs]);
  const tableDocs = useMemo(
    () =>
      groupFilter
        ? periodDocs.filter((d) => ((groupFilter.by === "client" ? d.clientName : d.siteName) || "미지정") === groupFilter.name)
        : periodDocs,
    [periodDocs, groupFilter]
  );
  const projectRows = useMemo(() => tripProjectRows(tableDocs), [tableDocs]);
  const groupRows = useMemo(() => (view === "project" ? [] : tripGroupRows(periodDocs, view)), [periodDocs, view]);
  const periodName = month ? `${year}년 ${month}월` : `${year}년`;
  const openDoc = openId ? periodDocs.find((d) => d.projectId === openId) : undefined;
  const picked = pickedDate ? calendar.get(pickedDate) : undefined;

  if (docs.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">{year}년에 출장으로 체크한 작업일지가 없습니다.</p>;
  }

  function pickMonth(m: number | null) {
    setMonth(m);
    setPickedDate(null);
  }
  function dayText(date: string) {
    return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <select
          aria-label="기간"
          value={month ?? ""}
          onChange={(e) => pickMonth(e.target.value ? Number(e.target.value) : null)}
          className={inlineFieldClass}
        >
          <option value="">{year}년 전체</option>
          {monthly.map((m) => (
            <option key={m.month} value={m.month} disabled={m.tripDays === 0}>
              {m.month}월{m.tripDays ? ` (출장 ${m.tripDays}일)` : ""}
            </option>
          ))}
        </select>
        {month && (
          <button type="button" onClick={() => pickMonth(null)} className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-800">
            한 해 전체 보기
          </button>
        )}
      </div>
      <p className="hidden text-xs text-slate-500 print:block">기간: {periodName}</p>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 print:grid-cols-4">
        <Tile label="출장 일수" value={`${totals.tripDays}일`} sub="같은 날 여러 프로젝트는 하루로" />
        <Tile label="출장 프로젝트" value={`${totals.projects}건`} />
        <Tile label="총 투입 인원" value={`${totals.people}명`} sub={`사내 ${totals.staff}명 · 조공 ${totals.helper}명`} />
        <Tile label="장비 투입" value={`${totals.equipmentDays}일`} sub="장비를 쓴 날" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[2fr_3fr] print:grid-cols-[2fr_3fr]">
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-600">
            월별 출장 일수 <span className="font-normal text-slate-400 print:hidden">— 막대를 누르면 그 달만</span>
          </p>
          <ul className="space-y-0.5">
            {monthly.map((m) => {
              const active = month === m.month;
              const ratio = maxDays ? m.tripDays / maxDays : 0;
              return (
                <li key={m.month}>
                  <button
                    type="button"
                    disabled={m.tripDays === 0}
                    aria-pressed={active}
                    onClick={() => pickMonth(active ? null : m.month)}
                    title={m.tripDays ? `${m.month}월 출장 ${m.tripDays}일 · 투입 ${m.people}명 · 프로젝트 ${m.projects}건` : `${m.month}월 출장 없음`}
                    className={cx(
                      "flex w-full items-center gap-2 rounded-md px-1 py-1 text-left",
                      m.tripDays > 0 && "hover:bg-slate-50",
                      active && "bg-indigo-50"
                    )}
                  >
                    <span className={cx("w-8 shrink-0 text-xs tabular-nums", active ? "font-semibold text-slate-900" : "text-slate-500")}>
                      {m.month}월
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      {m.tripDays > 0 && (
                        <span
                          className={cx("h-3.5 shrink-0 rounded-r", month && !active ? "bg-indigo-200" : "bg-indigo-500")}
                          style={{ width: `max(0.25rem, calc((100% - 6rem) * ${ratio}))` }}
                        />
                      )}
                      <span className="whitespace-nowrap text-xs tabular-nums text-slate-700">
                        {m.tripDays ? `${m.tripDays}일${m.people ? ` · ${m.people}명` : ""}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="text-xs font-semibold text-slate-600">
              출장 달력 <span className="font-normal text-slate-400 print:hidden">— 칸을 누르면 그날 프로젝트</span>
            </p>
            <span className="flex items-center gap-1 text-[11px] text-slate-500">
              인원 적음
              {LEVEL_CLASS.slice(1).map((c) => (
                <span key={c} className={cx("h-2.5 w-2.5 rounded-[2px]", c)} />
              ))}
              많음
            </span>
          </div>
          <div className="grid gap-px sm:gap-[2px]" style={{ gridTemplateColumns: "1.75rem repeat(31, minmax(0, 1fr))" }}>
            <span />
            {Array.from({ length: 31 }, (_, i) => (
              // 휴대폰에선 칸이 좁아 "10"이 두 줄로 쪼개져서, 칸 밖으로 넘쳐도 가운데 한 줄로
              <span key={i} className="flex justify-center whitespace-nowrap text-[9px] leading-3 text-slate-400">
                {DAY_LABELS.has(i + 1) ? i + 1 : ""}
              </span>
            ))}
            {monthly.map(({ month: m }) => {
              const lastDay = new Date(year, m, 0).getDate();
              const dim = month !== null && month !== m;
              return (
                <Fragment key={m}>
                  <span className={cx("text-[10px] leading-3 tabular-nums", month === m ? "font-semibold text-slate-900" : "text-slate-500")}>
                    {m}월
                  </span>
                  {Array.from({ length: 31 }, (_, i) => {
                    const day = i + 1;
                    if (day > lastDay) return <span key={day} />;
                    const date = `${year}-${pad(m)}-${pad(day)}`;
                    const info = calendar.get(date);
                    const cell = cx(
                      "h-2.5 rounded-[2px] sm:h-3.5 lg:h-4",
                      LEVEL_CLASS[calendarLevel(info?.people ?? 0, maxPeople, Boolean(info))],
                      dim && "opacity-30",
                      pickedDate === date && "ring-2 ring-slate-900 ring-offset-1"
                    );
                    return info ? (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setPickedDate(pickedDate === date ? null : date)}
                        title={`${dayText(date)} · 투입 ${info.people}명 · ${info.projects.map((p) => p.label).join(", ")}`}
                        aria-label={`${dayText(date)} 출장 ${info.projects.length}건, 투입 ${info.people}명`}
                        className={cell}
                      />
                    ) : (
                      <span key={day} className={cell} />
                    );
                  })}
                </Fragment>
              );
            })}
          </div>
          {picked && pickedDate && (
            <p className="mt-2 text-xs text-slate-700 print:hidden">
              <span className="font-semibold">{dayText(pickedDate)}</span>
              {" — "}
              {picked.projects.map((p) => `${p.label}${p.people ? ` ${p.people}명` : ""}`).join(", ")}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border border-slate-300 p-0.5 print:hidden">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                aria-pressed={view === v.key}
                onClick={() => {
                  setView(v.key);
                  setGroupFilter(null);
                }}
                className={cx(
                  "rounded-md px-3 py-1 text-xs font-medium",
                  view === v.key ? "bg-brand-navy text-white" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
          <p className="hidden text-xs font-semibold text-slate-600 print:block">{VIEWS.find((v) => v.key === view)?.label}</p>
          {groupFilter && view === "project" && (
            <button
              type="button"
              onClick={() => setGroupFilter(null)}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 hover:bg-slate-200 print:hidden"
            >
              {groupFilter.name} 프로젝트만 ✕
            </button>
          )}
        </div>
        {view === "project" ? (
          <ProjectTable rows={projectRows} onOpen={setOpenId} />
        ) : (
          <GroupTable
            rows={groupRows}
            label={view === "client" ? "원청사" : "현장"}
            onPick={(name) => {
              setGroupFilter({ by: view, name });
              setView("project");
            }}
          />
        )}
      </div>

      {openDoc && <TripLogPopup key={`${openDoc.projectId}-${month ?? "all"}`} doc={openDoc} onClose={() => setOpenId(null)} />}
    </div>
  );
}
