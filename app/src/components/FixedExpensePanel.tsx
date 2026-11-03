"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { inlineFieldClass } from "@/components/ui/field";
import { EmptyRow, Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { setClientFixedExpense } from "@/lib/actions/fixedExpenses";
import { formatWon } from "@/lib/format";
import { cx } from "@/lib/cx";
import type { FixedExpenseReport, FixedExpenseRow } from "@/lib/fixedExpense";

// 보고서 "고정지출" 칸(사용자 요청 11/3 — 지정한 거래처의 최근 12개월 매입 ÷ 12 = 달 평균, 계산은 lib/fixedExpense.ts). 지정·해제는
// 거래처에 저장(101 SQL), 은행 거래는 안 씀(사용자: 자동이체도 매입매출장에 직접 등록). 표는 머리글로 정렬.

type SortKey = "name" | "monthlyAvg" | "total" | "monthsWithSpend" | "activeAvg" | "lastDate" | "thisMonth";
type CandidateKey = "name" | "monthsWithSpend" | "monthlyAvg" | "total";

function useSorted<K extends string>(rows: FixedExpenseRow[], initial: K, initialDir: "asc" | "desc") {
  const [sortKey, setSortKey] = useState<K>(initial);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialDir);
  const sorted = useMemo(() => {
    const value = (r: FixedExpenseRow): string | number => (r as unknown as Record<string, string | number | null>)[sortKey] ?? "";
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

export function FixedExpensePanel({
  report,
  ready,
  canEdit,
}: {
  report: FixedExpenseReport;
  /** 101 SQL 실행 뒤(거래처에 고정지출 칸이 있음) */
  ready: boolean;
  /** 관리자·직원만 지정·해제 */
  canEdit: boolean;
}) {
  const pending = useGlobalPending();
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const fixed = useSorted<SortKey>(report.rows, "monthlyAvg", "desc");
  const candidates = useSorted<CandidateKey>(report.candidates, "monthlyAvg", "desc");
  const win = report.window;
  const period = `${win.months[0]} ~ ${win.months[win.months.length - 1]}`;
  const editable = ready && canEdit;
  const openRow = openId ? report.rows.find((r) => r.clientId === openId) ?? null : null;

  async function toggle(clientId: string, value: boolean) {
    setError(null);
    const result = await pending.run(() => setClientFixedExpense(clientId, value));
    if (result?.error) setError(result.error);
    else if (value) setPick("");
  }

  return (
    <div className="space-y-4">
      {!ready && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          거래처를 고정지출로 지정하려면 Supabase SQL Editor에서 <span className="font-medium">101_client_fixed_expense.sql</span>을
          실행해 주세요(칸 1개만 추가 — 기존 자료는 그대로). 아래 후보는 지금도 볼 수 있습니다.
        </p>
      )}

      {/* 요약 */}
      <div className="rounded-xl bg-slate-50 px-4 py-3">
        <p className="text-xs text-slate-500">매달 기본으로 나가는 돈(지정한 거래처 {report.rows.length}곳의 달 평균 합)</p>
        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="whitespace-nowrap text-2xl font-bold tabular-nums text-slate-900">{formatWon(report.totalMonthly)}</span>
          <span className="whitespace-nowrap text-sm tabular-nums text-slate-600">1년 {formatWon(report.totalYear)}</span>
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          {period}(지난달까지 12개월) 매입 합계 ÷ 12 · 부가세 포함·외상 포함(거래일 기준) · 은행 거래는 넣지 않음 · 직접 입력한 매입처는
          거래처로 등록하면 지정할 수 있음
        </p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 print:hidden">{error}</p>}

      {editable && (
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            aria-label="고정지출로 지정할 거래처"
            className={`${inlineFieldClass} w-72 max-md:w-full`}
          >
            <option value="">지정할 거래처 고르기({report.others.length}곳)</option>
            {report.others.map((o) => (
              <option key={o.clientId} value={o.clientId}>
                {o.name} — 달 평균 {formatWon(o.monthlyAvg)} · {o.monthsWithSpend}/12달
              </option>
            ))}
          </select>
          <Button type="button" size="sm" disabled={!pick} onClick={() => toggle(pick, true)}>
            + 고정지출 지정
          </Button>
        </div>
      )}

      {/* 지정한 거래처 */}
      <Table className="sticky-col-table min-w-[860px]">
        <THead>
          {fixed.header("name", "거래처", "sticky-col pr-4")}
          {fixed.header("monthlyAvg", "달 평균(÷12)", "pr-4 text-right")}
          {fixed.header("total", "12달 합계", "pr-4 text-right")}
          {fixed.header("monthsWithSpend", "나온 달", "pr-4 text-right")}
          {fixed.header("activeAvg", "낸 달 평균", "pr-4 text-right")}
          {fixed.header("lastDate", "마지막 매입", "pr-4")}
          {fixed.header("thisMonth", "이번 달", "pr-4 text-right")}
          <Th className="text-right print:hidden">관리</Th>
        </THead>
        <tbody>
          {fixed.sorted.map((r) => (
            <Tr key={r.clientId}>
              <Td className="sticky-col pr-4 font-medium text-slate-800 max-md:max-w-[9rem] max-md:truncate print:max-w-none" title={r.name}>
                {r.name}
              </Td>
              <Td className="whitespace-nowrap pr-4 text-right font-semibold tabular-nums text-slate-900">{formatWon(r.monthlyAvg)}</Td>
              <Td className="whitespace-nowrap pr-4 text-right tabular-nums">{formatWon(r.total)}</Td>
              <Td className={cx("whitespace-nowrap pr-4 text-right tabular-nums", r.monthsWithSpend < 12 && "text-amber-700")}>
                {r.monthsWithSpend}/12
              </Td>
              <Td className="whitespace-nowrap pr-4 text-right tabular-nums text-slate-500">
                {r.monthsWithSpend > 0 && r.monthsWithSpend < 12 ? formatWon(r.activeAvg) : "-"}
              </Td>
              <Td className="whitespace-nowrap pr-4 tabular-nums text-slate-500">{r.lastDate ?? "-"}</Td>
              <Td className="whitespace-nowrap pr-4 text-right tabular-nums">
                {r.thisMonth ? formatWon(r.thisMonth) : <span className="text-slate-400">아직</span>}
              </Td>
              <Td className="whitespace-nowrap text-right print:hidden">
                <div className="flex justify-end gap-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    onClick={() => setOpenId(openId === r.clientId ? null : r.clientId)}
                    aria-expanded={openId === r.clientId}
                  >
                    월별
                  </Button>
                  {editable && (
                    <Button type="button" variant="secondary" size="xs" onClick={() => toggle(r.clientId, false)} title="고정지출 지정 해제">
                      해제
                    </Button>
                  )}
                </div>
              </Td>
            </Tr>
          ))}
          {fixed.sorted.length === 0 && (
            <EmptyRow colSpan={8}>
              {editable ? "아직 지정한 거래처가 없습니다. 위에서 거래처를 고르거나 아래 후보에서 지정해 주세요." : "지정한 거래처가 없습니다."}
            </EmptyRow>
          )}
          {fixed.sorted.length > 0 && (
            <tr className="border-t-2 border-slate-300 font-semibold">
              <td className="sticky-col py-2 pr-4 text-slate-800">합계</td>
              <td className="whitespace-nowrap py-2 pr-4 text-right tabular-nums text-slate-900">{formatWon(report.totalMonthly)}</td>
              <td className="whitespace-nowrap py-2 pr-4 text-right tabular-nums text-slate-900">{formatWon(report.totalYear)}</td>
              <td colSpan={5} />
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
            <button type="button" onClick={() => setOpenId(null)} className="text-xs text-slate-500 hover:text-slate-800 print:hidden">
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
          <span className="font-normal text-slate-500">— 지정 안 했지만 12달 중 10달 이상 매입이 있던 거래처(빠뜨린 곳 찾기)</span>
        </p>
        <Table className="min-w-[620px]">
          <THead>
            {candidates.header("name", "거래처", "pr-4")}
            {candidates.header("monthsWithSpend", "나온 달", "pr-4 text-right")}
            {candidates.header("monthlyAvg", "달 평균(÷12)", "pr-4 text-right")}
            {candidates.header("total", "12달 합계", "pr-4 text-right")}
            {editable && <Th className="text-right print:hidden">지정</Th>}
          </THead>
          <tbody>
            {candidates.sorted.map((r) => (
              <Tr key={r.clientId}>
                <Td className="pr-4 font-medium text-slate-800 max-md:max-w-[10rem] max-md:truncate print:max-w-none" title={r.name}>
                  {r.name}
                </Td>
                <Td className="whitespace-nowrap pr-4 text-right tabular-nums">{r.monthsWithSpend}/12</Td>
                <Td className="whitespace-nowrap pr-4 text-right tabular-nums">{formatWon(r.monthlyAvg)}</Td>
                <Td className="whitespace-nowrap pr-4 text-right tabular-nums">{formatWon(r.total)}</Td>
                {editable && (
                  <Td className="whitespace-nowrap text-right print:hidden">
                    <Button type="button" variant="secondary" size="xs" onClick={() => toggle(r.clientId, true)}>
                      지정
                    </Button>
                  </Td>
                )}
              </Tr>
            ))}
            {candidates.sorted.length === 0 && <EmptyRow colSpan={editable ? 5 : 4}>후보가 없습니다.</EmptyRow>}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
