"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { inlineFieldClass } from "@/components/ui/field";
import { EmptyRow, Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { setCategoryFixedExpense, setClientFixedExpense } from "@/lib/actions/fixedExpenses";
import { formatWon } from "@/lib/format";
import { cx } from "@/lib/cx";
import type { FixedExpenseKind, FixedExpenseReport, FixedExpenseRow } from "@/lib/fixedExpense";

// 보고서 "고정지출" 칸(사용자 요청 11/3 — 지정한 거래처·카테고리의 최근 12개월 매입 ÷ 12 = 달 평균, 계산은 lib/fixedExpense.ts). 지정·해제는
// 거래처(101 SQL)·카테고리(102 SQL)에 저장, 은행 거래는 안 씀(사용자: 자동이체도 매입매출장에 직접 등록). 한 거래는 한 줄에만(지정 거래처 →
// 지정 카테고리). 표는 머리글로 정렬.

type SortKey =
  | "name"
  | "kind"
  | "monthlyAvg"
  | "total"
  | "monthsWithSpend"
  | "activeAvg"
  | "minMonth"
  | "lastDate"
  | "thisMonth";
type CandidateKey = "name" | "kind" | "monthsWithSpend" | "monthlyAvg" | "total";

const KIND_LABEL: Record<FixedExpenseKind, string> = { client: "거래처", category: "카테고리" };

function useSorted<K extends string>(rows: FixedExpenseRow[], initial: K, initialDir: "asc" | "desc") {
  const [sortKey, setSortKey] = useState<K>(initial);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialDir);
  const sorted = useMemo(() => {
    const value = (r: FixedExpenseRow): string | number =>
      sortKey === "kind" ? KIND_LABEL[r.kind] : (r as unknown as Record<string, string | number | null>)[sortKey] ?? "";
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ko");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);
  function handleSort(key: K) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }
  function header(key: K, label: string, className?: string) {
    return (
      <Th className={className}>
        <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 hover:text-slate-800">
          {label}
          {sortKey === key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
        </button>
      </Th>
    );
  }
  return { sorted, header };
}

const monthLabel = (ym: string) => `${ym.slice(2, 4)}.${ym.slice(5, 7)}`;

function KindTag({ kind }: { kind: FixedExpenseKind }) {
  return (
    <span
      className={cx(
        "inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium",
        kind === "client" ? "bg-sky-50 text-sky-800" : "bg-violet-50 text-violet-800"
      )}
    >
      {KIND_LABEL[kind]}
    </span>
  );
}

function Picker({
  label,
  options,
  onPick,
}: {
  label: string;
  options: FixedExpenseRow[];
  onPick: (id: string) => Promise<boolean>;
}) {
  const [pick, setPick] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2 max-md:w-full">
      <select
        value={pick}
        onChange={(e) => setPick(e.target.value)}
        aria-label={`고정지출로 지정할 ${label}`}
        className={`${inlineFieldClass} w-64 max-md:w-full`}
      >
        <option value="">
          지정할 {label} 고르기({options.length}곳)
        </option>
        {options.map((o) => (
          <option key={o.key} value={o.id}>
            {o.name} — 달 평균 {formatWon(o.monthlyAvg)} · {o.monthsWithSpend}/12달
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        disabled={!pick}
        onClick={async () => {
          if (await onPick(pick)) setPick("");
        }}
      >
        + {label} 지정
      </Button>
    </div>
  );
}

export function FixedExpensePanel({
  report,
  clientReady,
  categoryReady,
  canEdit,
}: {
  report: FixedExpenseReport;
  /** 101 SQL 실행 뒤(거래처에 고정지출 칸이 있음) */
  clientReady: boolean;
  /** 102 SQL 실행 뒤(카테고리에 고정지출 칸이 있음) */
  categoryReady: boolean;
  /** 관리자·직원만 지정·해제 */
  canEdit: boolean;
}) {
  const pending = useGlobalPending();
  const [error, setError] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const fixed = useSorted<SortKey>(report.rows, "monthlyAvg", "desc");
  const candidates = useSorted<CandidateKey>(report.candidates, "monthlyAvg", "desc");
  const win = report.window;
  const period = `${win.months[0]} ~ ${win.months[win.months.length - 1]}`;
  const canEditKind = (kind: FixedExpenseKind) => canEdit && (kind === "client" ? clientReady : categoryReady);
  const openRow = openKey ? report.rows.find((r) => r.key === openKey) ?? null : null;
  const clientCount = report.rows.filter((r) => r.kind === "client").length;
  const categoryCount = report.rows.length - clientCount;

  async function toggle(kind: FixedExpenseKind, id: string, value: boolean) {
    setError(null);
    try {
      const result = await pending.run(() => (kind === "client" ? setClientFixedExpense(id, value) : setCategoryFixedExpense(id, value)));
      if (result?.error) {
        setError(result.error);
        return false;
      }
      return true;
    } catch {
      // 연결이 끊기는 등 액션 호출 자체가 실패해도 된 것처럼 두지 않음(고른 값은 그대로) — 브라우저 영어 문구("Failed to fetch") 대신
      setError("저장하지 못했습니다(연결이 끊겼거나 서버 오류). 잠시 뒤 다시 해 주세요.");
      return false;
    }
  }

  return (
    <div className="space-y-4">
      {(!clientReady || !categoryReady) && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {!clientReady && (
            <>
              거래처를 지정하려면 <span className="font-medium">101_client_fixed_expense.sql</span>
              {!categoryReady && ", "}
            </>
          )}
          {!categoryReady && (
            <>
              카테고리를 지정하려면 <span className="font-medium">102_category_fixed_expense.sql</span>
            </>
          )}
          을 Supabase SQL Editor에서 실행해 주세요(칸만 추가 — 기존 자료는 그대로). 아래 후보는 지금도 볼 수 있습니다.
        </p>
      )}

      {/* 요약 */}
      <div className="rounded-xl bg-slate-50 px-4 py-3">
        <p className="text-xs text-slate-500">
          매달 기본으로 나가는 돈(지정한 거래처 {clientCount}곳·카테고리 {categoryCount}개의 달 평균 합)
        </p>
        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="whitespace-nowrap text-2xl font-bold tabular-nums text-slate-900">{formatWon(report.totalMonthly)}</span>
          <span className="whitespace-nowrap text-sm tabular-nums text-slate-600">1년 {formatWon(report.totalYear)}</span>
          {categoryCount > 0 && clientCount > 0 && (
            <span className="whitespace-nowrap text-xs tabular-nums text-slate-500">
              거래처 {formatWon(report.clientMonthly)} + 카테고리 {formatWon(report.categoryMonthly)}
            </span>
          )}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          {period}(지난달까지 12개월) 매입 합계 ÷ 12 · 부가세 포함·외상 포함(거래일 기준) · 한 거래는 한 번만(지정 거래처에서 산 건 거래처 줄,
          나머지는 지정 카테고리 줄) · 카테고리는 프로젝트에 걸린 매입도 포함 · 은행 거래는 넣지 않음 · 급여는 매입매출장 급여 카테고리
          기준(직원·급여 메뉴 기록은 따로 안 셈)
        </p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 print:hidden">{error}</p>}

      {canEdit && (clientReady || categoryReady) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 print:hidden">
          {clientReady && <Picker label="거래처" options={report.otherClients} onPick={(id) => toggle("client", id, true)} />}
          {categoryReady && <Picker label="카테고리" options={report.otherCategories} onPick={(id) => toggle("category", id, true)} />}
        </div>
      )}

      {/* 지정한 거래처·카테고리 */}
      {/* xl:min-w-0 — 좁은 화면은 옆으로 넘기지만(1020px), 가로 1280 노트북에선 상자(약 930px)에 맞춰 관리(월별·해제) 칸까지 보이게 */}
      <Table className="sticky-col-table min-w-[1020px] xl:min-w-0 print:min-w-0 print:text-xs">
        <THead>
          {fixed.header("name", "거래처·카테고리", "sticky-col pr-3")}
          {fixed.header("kind", "구분", "pr-3")}
          {fixed.header("monthlyAvg", "달 평균(÷12)", "pr-3 text-right")}
          {fixed.header("total", "12달 합계", "pr-3 text-right")}
          {fixed.header("monthsWithSpend", "나온 달", "pr-3 text-right")}
          {fixed.header("activeAvg", "낸 달 평균", "pr-3 text-right")}
          {fixed.header("minMonth", "달마다 범위", "pr-3 text-right")}
          {fixed.header("lastDate", "마지막 매입", "pr-3")}
          {fixed.header("thisMonth", "이번 달", "pr-3 text-right")}
          <Th className="text-right print:hidden">관리</Th>
        </THead>
        <tbody>
          {fixed.sorted.map((r) => (
            <Tr key={r.key}>
              <Td className="sticky-col pr-3 font-medium text-slate-800 max-md:max-w-[9rem] max-md:truncate print:max-w-none print:overflow-visible print:whitespace-normal" title={r.name}>
                {r.name}
              </Td>
              <Td className="pr-3">
                <KindTag kind={r.kind} />
              </Td>
              <Td className="whitespace-nowrap pr-3 text-right font-semibold tabular-nums text-slate-900">{formatWon(r.monthlyAvg)}</Td>
              <Td className="whitespace-nowrap pr-3 text-right tabular-nums">{formatWon(r.total)}</Td>
              <Td className={cx("whitespace-nowrap pr-3 text-right tabular-nums", r.monthsWithSpend < 12 && "text-amber-700")}>
                {r.monthsWithSpend}/12
              </Td>
              <Td className="whitespace-nowrap pr-3 text-right tabular-nums text-slate-500">
                {r.monthsWithSpend > 0 && r.monthsWithSpend < 12 ? formatWon(r.activeAvg) : "-"}
              </Td>
              {/* 금액이 크면 PC에서 "~" 뒤에서 줄바꿈(금액은 안 끊김) — 휴대폰은 표 칸이 한 줄(globals.css) */}
              <Td className="pr-3 text-right tabular-nums text-slate-500" title="가장 적은 달 ~ 가장 많은 달(매입 없는 달은 0원)">
                {r.minMonth === r.maxMonth ? (
                  <span className="whitespace-nowrap">{formatWon(r.maxMonth)}</span>
                ) : (
                  <>
                    <span className="whitespace-nowrap">{formatWon(r.minMonth)} ~</span>{" "}
                    <span className="whitespace-nowrap">{formatWon(r.maxMonth)}</span>
                  </>
                )}
              </Td>
              <Td className="whitespace-nowrap pr-3 tabular-nums text-slate-500">{r.lastDate ?? "-"}</Td>
              <Td className="whitespace-nowrap pr-3 text-right tabular-nums">
                {r.thisMonth ? formatWon(r.thisMonth) : <span className="text-slate-400">아직</span>}
              </Td>
              <Td className="whitespace-nowrap text-right print:hidden">
                <div className="flex justify-end gap-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    onClick={() => setOpenKey(openKey === r.key ? null : r.key)}
                    aria-expanded={openKey === r.key}
                  >
                    월별
                  </Button>
                  {canEditKind(r.kind) && (
                    <Button type="button" variant="secondary" size="xs" onClick={() => toggle(r.kind, r.id, false)} title="고정지출 지정 해제">
                      해제
                    </Button>
                  )}
                </div>
              </Td>
            </Tr>
          ))}
          {fixed.sorted.length === 0 && (
            <EmptyRow colSpan={10}>
              {canEdit && (clientReady || categoryReady)
                ? "아직 지정한 거래처·카테고리가 없습니다. 위에서 고르거나 아래 후보에서 지정해 주세요."
                : "지정한 거래처·카테고리가 없습니다."}
            </EmptyRow>
          )}
          {fixed.sorted.length > 0 && (
            <tr className="border-t-2 border-slate-300 font-semibold">
              <td className="sticky-col py-2 pr-3 text-slate-800">합계</td>
              <td />
              <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums text-slate-900">{formatWon(report.totalMonthly)}</td>
              <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums text-slate-900">{formatWon(report.totalYear)}</td>
              <td colSpan={6} />
            </tr>
          )}
        </tbody>
      </Table>

      {/* 월별 — 표 밖에(휴대폰에서 표를 옆으로 넘긴 채 눌러도 잘리지 않게) */}
      {openRow && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800">
              {openRow.name} — 월별 매입 <span className="font-normal text-slate-500">({period})</span>
            </p>
            <button type="button" onClick={() => setOpenKey(null)} className="text-xs text-slate-500 hover:text-slate-800 print:hidden">
              닫기
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs tabular-nums min-[480px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
            {win.months.map((m, i) => (
              <span key={m} className={cx("flex justify-between gap-2", openRow.perMonth[i] === 0 && "text-slate-400")}>
                <span>{monthLabel(m)}</span>
                <span className="whitespace-nowrap">{openRow.perMonth[i] ? formatWon(openRow.perMonth[i]) : "-"}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 후보 */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-800">
          고정지출 후보 {report.candidates.length}곳{" "}
          <span className="font-normal text-slate-500">
            — 지정 안 했지만 12달 중 10달 이상 매입이 있던 거래처·카테고리(빠뜨린 곳 찾기, 이미 위 표에 들어간 매입은 빼고 셈)
          </span>
        </p>
        <Table className="min-w-[680px] print:min-w-0 print:text-xs">
          <THead>
            {candidates.header("name", "거래처·카테고리", "pr-4")}
            {candidates.header("kind", "구분", "pr-4")}
            {candidates.header("monthsWithSpend", "나온 달", "pr-4 text-right")}
            {candidates.header("monthlyAvg", "달 평균(÷12)", "pr-4 text-right")}
            {candidates.header("total", "12달 합계", "pr-4 text-right")}
            {canEdit && <Th className="text-right print:hidden">지정</Th>}
          </THead>
          <tbody>
            {candidates.sorted.map((r) => (
              <Tr key={r.key}>
                <Td className="pr-4 font-medium text-slate-800 max-md:max-w-[10rem] max-md:truncate print:max-w-none print:overflow-visible print:whitespace-normal" title={r.name}>
                  {r.name}
                </Td>
                <Td className="pr-4">
                  <KindTag kind={r.kind} />
                </Td>
                <Td className="whitespace-nowrap pr-4 text-right tabular-nums">{r.monthsWithSpend}/12</Td>
                <Td className="whitespace-nowrap pr-4 text-right tabular-nums">{formatWon(r.monthlyAvg)}</Td>
                <Td className="whitespace-nowrap pr-4 text-right tabular-nums">{formatWon(r.total)}</Td>
                {canEdit && (
                  <Td className="whitespace-nowrap text-right print:hidden">
                    {canEditKind(r.kind) ? (
                      <Button type="button" variant="secondary" size="xs" onClick={() => toggle(r.kind, r.id, true)}>
                        지정
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">SQL 실행 후</span>
                    )}
                  </Td>
                )}
              </Tr>
            ))}
            {candidates.sorted.length === 0 && <EmptyRow colSpan={canEdit ? 6 : 5}>후보가 없습니다.</EmptyRow>}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
